#!/bin/bash
# Держит сайт включённым на сервере, даже если закрыть ноут / SSH.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="$(id -un)"
PYTHON_SYS="${PYTHON:-python3}"
VENV="$DIR/.venv"
UNIT_NAME="ty-menya"
UNIT_PATH="/etc/systemd/system/${UNIT_NAME}.service"
PORT="${PORT:-8080}"

echo "Папка сайта: $DIR"
echo "Пользователь: $USER_NAME"

if ! command -v "$PYTHON_SYS" >/dev/null; then
  echo "Нужен python3. На Ubuntu: sudo apt update && sudo apt install -y python3 python3-venv python3-full"
  exit 1
fi

echo "Создаю виртуальное окружение…"
"$PYTHON_SYS" -m venv "$VENV"
"$VENV/bin/python" -m py_compile "$DIR/server.py"

echo "Останавливаю старые запуски в терминале (они падают, когда закрываешь ноут)…"
pkill -f "$DIR/server.py" 2>/dev/null || true
pkill -f "python3 -m http.server ${PORT}" 2>/dev/null || true
sleep 1

if ! command -v systemctl >/dev/null; then
  echo "systemd нет — ставлю автозапуск через crontab + nohup"
  mkdir -p "$DIR/logs"
  START_LINE="@reboot cd $DIR && $VENV/bin/python $DIR/server.py >> $DIR/logs/site.log 2>&1 &"
  (crontab -l 2>/dev/null | grep -v "server.py" || true; echo "$START_LINE") | crontab -
  nohup "$VENV/bin/python" "$DIR/server.py" >> "$DIR/logs/site.log" 2>&1 &
  echo "Готово. Сайт запущен в фоне. Ноут можно закрывать."
  echo "Проверка: curl -sI http://127.0.0.1:${PORT}/ | head -1"
  exit 0
fi

if ! sudo -n true 2>/dev/null; then
  echo "Нужен sudo один раз, чтобы служба стартовала после перезагрузки сервера."
fi

TMP_UNIT="$(mktemp)"
cat > "$TMP_UNIT" <<EOF
[Unit]
Description=Ty menya prostish (romantic site + Telegram)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER_NAME}
Group=${USER_NAME}
WorkingDirectory=${DIR}
ExecStart=${VENV}/bin/python ${DIR}/server.py
Restart=always
RestartSec=2
Environment=HOST=0.0.0.0
Environment=PORT=${PORT}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo mv "$TMP_UNIT" "$UNIT_PATH"
sudo chmod 644 "$UNIT_PATH"
sudo systemctl daemon-reload
sudo systemctl enable "$UNIT_NAME"
sudo systemctl restart "$UNIT_NAME"
sleep 1
sudo systemctl --no-pager --full status "$UNIT_NAME" || true

echo
echo "Готово. Сайт крутится сам на сервере."
echo "Ноут можно выключать — AWS/сервер должен оставаться Running."
echo "Проверка: curl -sI http://127.0.0.1:${PORT}/ | head -1"
echo
echo "Полезные команды:"
echo "  sudo systemctl status ty-menya"
echo "  sudo systemctl restart ty-menya"
echo "  sudo journalctl -u ty-menya -n 50"
