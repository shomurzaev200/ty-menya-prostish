#!/usr/bin/env python3
"""Static site + Telegram Bot API. Token stays on the server, never in the page."""
from __future__ import annotations

import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STORE = ROOT / "telegram.json"
TOKEN_RE = re.compile(r"^\d{6,}:[A-Za-z0-9_-]{20,}$")
HITS: list[float] = []
CTX = ssl.create_default_context()


def load_store() -> dict:
    try:
        data = json.loads(STORE.read_text("utf-8"))
        if isinstance(data, dict):
            return data
    except OSError:
        pass
    except json.JSONDecodeError:
        pass
    return {}


def save_store(data: dict) -> None:
    STORE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        os.chmod(STORE, 0o600)
    except OSError:
        pass


def status_payload(store: dict) -> dict:
    token = str(store.get("token") or "")
    chat = str(store.get("chatId") or "")
    bot = str(store.get("botUsername") or "")
    return {
        "configured": bool(token and chat),
        "botUsername": bot or None,
        "skipped": bool(store.get("skipped")) and not (token and chat),
    }


def looks_like_token(token: str) -> bool:
    return bool(TOKEN_RE.match(token.strip()))


def friendly_error(desc: str) -> str:
    d = desc.lower()
    if "unauthorized" in d:
        return "Токен неверный. Скопируй его заново из @BotFather."
    if "chat not found" in d:
        return "Чат не найден. Открой бота в Telegram и нажми Start, потом повтори."
    if "bot was blocked" in d:
        return "Бот заблокирован. Разблокируй его в Telegram."
    if "too many" in d:
        return "Telegram просит подождать пару секунд."
    return desc[:180]


def telegram(token: str, method: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token.strip()}/{method}",
        data=json.dumps(body or {}).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20, context=CTX) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            raise RuntimeError(friendly_error(f"HTTP {err.code}")) from err
    except urllib.error.URLError as err:
        raise RuntimeError("Не удалось связаться с Telegram. Проверь интернет на сервере.") from err
    if not payload.get("ok"):
        raise RuntimeError(friendly_error(str(payload.get("description") or "ошибка Telegram")))
    return payload


def clip(value: str, max_len: int) -> str:
    return " ".join(str(value).split())[:max_len]


def rate_limited() -> bool:
    now = time.time()
    while HITS and now - HITS[0] > 600:
        HITS.pop(0)
    if len(HITS) >= 12:
        return True
    HITS.append(now)
    return False


def list_chats(token: str) -> list[dict]:
    telegram(token, "getMe")
    updates = telegram(token, "getUpdates", {"timeout": 0, "limit": 40})
    seen: dict[str, dict] = {}
    for item in updates.get("result") or []:
        chat = (item.get("message") or {}).get("chat") or (item.get("my_chat_member") or {}).get("chat")
        if not chat or chat.get("id") is None:
            continue
        cid = str(chat["id"])
        title = chat.get("title") or chat.get("first_name") or chat.get("username") or cid
        if cid not in seen:
            seen[cid] = {"id": cid, "title": title, "type": chat.get("type") or "private"}
    return list(seen.values())


def handle_api(body: dict) -> tuple[int, dict]:
    action = str(body.get("action") or "")
    store = load_store()

    if action == "status":
        return 200, status_payload(store)

    if action == "skip":
        store["skipped"] = True
        save_store(store)
        return 200, status_payload(store)

    if action == "chats":
        token = str(body.get("token") or "").strip()
        if not looks_like_token(token):
            return 400, {"error": "Это не похоже на токен бота. Он выглядит так: 123456789:AA...."}
        try:
            chats = list_chats(token)
        except RuntimeError as err:
            return 400, {"error": str(err)}
        return 200, {"chats": chats}

    if action == "save":
        token = str(body.get("token") or "").strip()
        chat_id = str(body.get("chatId") or "").strip()
        if not looks_like_token(token):
            return 400, {"error": "Это не похоже на токен бота. Скопируй его из @BotFather."}
        if not chat_id:
            return 400, {"error": "Сначала выбери чат — куда присылать сообщения."}
        try:
            me = telegram(token, "getMe")
            telegram(
                token,
                "sendMessage",
                {
                    "chat_id": chat_id,
                    "text": "Проверка: уведомления работают ❤️\nКогда она нажмёт «Да» или назначит свидание — я напишу сюда.",
                },
            )
        except RuntimeError as err:
            return 400, {"error": str(err)}
        username = ((me.get("result") or {}).get("username") or "").strip()
        save_store(
            {
                "token": token,
                "chatId": chat_id,
                "botUsername": f"@{username}" if username else "",
                "skipped": False,
            }
        )
        return 200, status_payload(load_store())

    if action == "notify":
        if body.get("hp"):
            return 200, {"ok": True}
        if rate_limited():
            return 200, {"ok": False, "error": "Слишком много уведомлений. Подожди немного."}
        token = str(store.get("token") or "")
        chat_id = str(store.get("chatId") or "")
        if not token or not chat_id:
            return 200, {"ok": False, "error": "Telegram ещё не подключён."}
        kind = str(body.get("kind") or "")
        if kind == "yes":
            n = max(0, min(99, int(body.get("attempts") or 0)))
            text = f"Любимая нажала «Да» ❤️\n\nПопыток сказать «нет»: {n}"
        elif kind == "meeting":
            date = clip(str(body.get("date") or ""), 32)
            t = clip(str(body.get("time") or ""), 16)
            place = clip(str(body.get("place") or ""), 120)
            text = f"Любимая назначила свидание ❤️\n\n📅 {date or '—'}\n🕐 {t or '—'}\n📍 {place or '—'}"
        elif kind == "test":
            text = "Проверка: уведомления работают ❤️"
        else:
            return 400, {"error": "Неизвестное событие."}
        try:
            telegram(token, "sendMessage", {"chat_id": chat_id, "text": text})
        except RuntimeError as err:
            return 200, {"ok": False, "error": str(err)}
        return 200, {"ok": True}

    return 400, {"error": "Неизвестный запрос."}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        name = path.rstrip("/").rsplit("/", 1)[-1]
        if name in {"telegram.json", ".telegram.json"}:
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/api/tg":
            self.send_error(404, "Not found")
            return
        length = int(self.headers.get("content-length") or 0)
        if length > 8000:
            self._json(400, {"error": "Слишком большое сообщение."})
            return
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("not object")
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self._json(400, {"error": "Некорректный запрос."})
            return
        code, payload = handle_api(body)
        self._json(code, payload)

    def _json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8080"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Сайт с Telegram: http://{host}:{port}/", flush=True)
    print("Зажми большое сердце 💗 на 2 секунды, чтобы подключить бота.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nСтоп.", flush=True)


if __name__ == "__main__":
    main()
