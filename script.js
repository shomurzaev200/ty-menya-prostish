const CONFIG = {
  senderName: "Абдулазиз",
  recipientName: "Любимая",
  apologyTitle: "Извини меня… 🥺",
  apologyText: "Я был не прав.",
  apologyFollow: "Правда прости меня ❤️",
  question: "Ты меня простишь?",
  questionHint: "Ну пожалуйста… 🥺❤️",
  loveMessage: "Я так и знал! Ты меня любишь ❤️",
  meetingTitle: "Может, теперь встретимся? 🥹❤️",
  telegramUrl: "",
  defaultMeetingPlace: "",
  photoUrl: "",
  musicEnabled: true,
};

const YES_SCALE = [1, 1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7];
const NO_PHRASES = [
  "Точно нет? 🥺",
  "Ты уверена? 😭",
  "Подумай ещё раз 😏",
  "Ну пожалуйста ❤️",
  "Я знаю, что ты меня любишь 😌",
  "Не получится 😎",
  "А кнопка «Да» тебе больше подходит ❤️",
  "Ну хватит убегать от любви 😂",
  "Последний шанс 😏",
  "Всё, я понял... ты просто вредничаешь 😂❤️",
  "Ладно, я понял 😂 Ты просто проверяешь, насколько сильно я тебя люблю.",
  "Ты реально всё ещё пытаешься? 😂❤️",
];
const SIDE_QUIPS = [
  "😭 Ты серьёзно?",
  "🥺 Ну пожалуйста...",
  "❤️ Я исправлюсь!",
  "😏 Я всё равно знаю ответ.",
  "😂 Не убежишь!",
  "🥰 Скажи «Да».",
];
const TIMES = ["18:00", "19:00", "20:00", "21:00"];
const STEPS = ["❤️", "💕", "💗", "💕", "❤️"];

const state = {
  screen: "forgive",
  line: 0,
  showQuestion: false,
  attempts: 0,
  phrase: "",
  quip: "",
  date: "",
  time: "",
  customTime: false,
  place: CONFIG.defaultMeetingPlace,
  later: false,
  error: "",
  muted: false,
};

const els = {
  screen: document.getElementById("screen"),
  hearts: document.getElementById("hearts"),
  progress: document.getElementById("progress"),
  mute: document.getElementById("mute"),
  secret: document.getElementById("secret"),
  noFloat: document.getElementById("no-float"),
};

let lastFlee = 0;
const rapid = [];
let musicCtl = null;
let musicStarted = false;

function portrait() {
  if (CONFIG.photoUrl) {
    return `<div class="portrait"><img src="${CONFIG.photoUrl}" alt="" /></div>`;
  }
  return `<div class="portrait"><span class="beat">💗</span></div>`;
}

function stepIndex() {
  if (state.screen === "forgive") return state.showQuestion ? 1 : 0;
  if (state.screen === "loved") return 2;
  if (state.screen === "ask") return 3;
  return 4;
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function renderProgress() {
  const s = stepIndex();
  els.progress.innerHTML = STEPS.map((g, i) => {
    const op = i <= s ? "1" : "0.4";
    const dash = i < STEPS.length - 1 ? `<span style="opacity:.4">─</span>` : "";
    return `<span style="opacity:${op}">${g}</span>${dash}`;
  }).join("");
}

function render() {
  renderProgress();
  const sc = els.screen;
  sc.className = "card" + (state.screen === "plan" ? " left" : "");
  if (state.screen === "forgive") {
    const scale = YES_SCALE[Math.min(state.attempts, YES_SCALE.length - 1)];
    sc.innerHTML = `
      ${portrait()}
      <p class="title fade">${CONFIG.apologyTitle}</p>
      <p class="sub ${state.line >= 1 ? "fade" : ""}">${state.line >= 1 ? CONFIG.apologyText : " "}</p>
      <p class="hint ${state.line >= 2 ? "fade" : ""}">${state.line >= 2 ? CONFIG.apologyFollow : " "}</p>
      ${
        state.showQuestion
          ? `<div class="fade" style="margin-top:32px">
              <h1>${CONFIG.question}</h1>
              <p class="hint">${CONFIG.questionHint}</p>
              ${state.phrase ? `<p>${state.phrase}</p>` : ""}
              ${state.quip ? `<p class="quip">${state.quip}</p>` : ""}
              <p class="tiny">Попыток сказать «нет»: ${state.attempts} 😏</p>
              <div class="actions">
                <button class="btn-yes" id="yes" type="button" style="transform:scale(${Math.min(scale, 2.15)})">Да ❤️</button>
                ${state.attempts === 0 ? `<button class="btn-no" id="no" type="button">Нет 😤</button>` : ""}
              </div>
            </div>`
          : ""
      }`;
    document.getElementById("yes")?.addEventListener("click", onYes);
    bindNo(document.getElementById("no"));
    if (state.attempts === 0) els.noFloat.classList.add("hidden");
  } else if (state.screen === "loved") {
    els.noFloat.classList.add("hidden");
    sc.innerHTML = `
      <div class="beat" style="font-size:72px">❤️</div>
      <h1 style="margin-top:20px">Я ТАК И ЗНАЛ! 😎❤️</h1>
      <p class="sub">Ты меня любишь! 🥰</p>
      <p class="hint">Я тоже тебя очень люблю ❤️</p>
      <p class="tiny">И я знал, что ты меня простишь 😌</p>
      <div class="actions"><button class="btn-yes" id="next" type="button">Дальше →</button></div>`;
    document.getElementById("next").onclick = () => {
      state.screen = "ask";
      render();
    };
  } else if (state.screen === "ask") {
    sc.innerHTML = `
      <p class="tiny" style="letter-spacing:.22em;text-transform:uppercase">Раз уж ты меня простила… 🥹❤️</p>
      <h1>${CONFIG.meetingTitle}</h1>
      <p class="sub">Я хочу увидеть тебя не через экран,<br/>а вживую ❤️</p>
      ${state.later ? `<p class="tiny">Хорошо, я подожду 🥺 Но «Конечно» всё равно можно нажать.</p>` : ""}
      <div class="actions col">
        <button class="btn-yes" id="sure" type="button">Конечно ❤️</button>
        <button class="btn-ghost" id="later" type="button">Давай позже 🥺</button>
      </div>`;
    document.getElementById("sure").onclick = () => {
      state.screen = "plan";
      render();
    };
    document.getElementById("later").onclick = () => {
      state.later = true;
      render();
    };
  } else if (state.screen === "plan") {
    const today = new Date().toISOString().slice(0, 10);
    sc.innerHTML = `
      <h1 style="text-align:center">Тогда это свидание! 🥰❤️</h1>
      <label>📅 Дата
        <input class="field" id="date" type="date" min="${today}" value="${state.date}" />
        ${state.date ? `<span class="tiny">📅 ${formatDate(state.date)}</span>` : ""}
      </label>
      <label>🕐 Время</label>
      <div class="chips" id="times"></div>
      ${state.customTime ? `<input class="field" id="time" type="time" value="${state.time}" />` : ""}
      <label>📍 Место
        <input class="field" id="place" placeholder="Например: любимое кафе ❤️" value="${escapeHtml(state.place)}" />
      </label>
      ${state.error ? `<p class="err">${state.error}</p>` : ""}
      <div class="actions"><button class="btn-yes" id="come" type="button">Я приду ❤️</button></div>`;
    const times = document.getElementById("times");
    TIMES.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.time === t && !state.customTime ? " on" : "");
      b.textContent = t;
      b.onclick = () => {
        state.customTime = false;
        state.time = t;
        render();
      };
      times.appendChild(b);
    });
    const own = document.createElement("button");
    own.type = "button";
    own.className = "chip" + (state.customTime ? " on" : "");
    own.textContent = "Своё";
    own.onclick = () => {
      state.customTime = true;
      state.time = "";
      render();
    };
    times.appendChild(own);
    document.getElementById("date").onchange = (e) => {
      state.date = e.target.value;
      render();
    };
    const timeEl = document.getElementById("time");
    if (timeEl)
      timeEl.onchange = (e) => {
        state.time = e.target.value;
      };
    document.getElementById("place").oninput = (e) => {
      state.place = e.target.value;
    };
    document.getElementById("come").onclick = () => {
      state.place = document.getElementById("place").value;
      if (state.customTime) state.time = document.getElementById("time")?.value || state.time;
      if (!state.date || !state.time || !state.place.trim()) {
        state.error = "Выбери дату, время и место — иначе это не свидание 😏";
        render();
        return;
      }
      state.error = "";
      burst();
      state.screen = "done";
      render();
    };
  } else if (state.screen === "done") {
    sc.innerHTML = `
      <div class="beat" style="font-size:72px">❤️</div>
      <h1 style="margin-top:16px">Договорились! ❤️</h1>
      <p class="sub">Теперь отступать нельзя 😏</p>
      <p class="hint">Я уже жду нашей встречи 🥰</p>
      <div class="meta">
        <p>📅 ${formatDate(state.date)}</p>
        <p>🕐 ${state.time}</p>
        <p>📍 ${escapeHtml(state.place)}</p>
      </div>
      <p class="title" style="font-size:28px;margin-top:28px">❤️ СВИДАНИЕ СОСТОИТСЯ ❤️</p>
      ${
        CONFIG.telegramUrl
          ? `<div class="actions"><a class="btn-yes" href="${CONFIG.telegramUrl}" target="_blank" rel="noreferrer">Написать мне в Telegram 💬</a></div>`
          : ""
      }
      <p class="tiny">С ${escapeHtml(CONFIG.senderName)} — для ${escapeHtml(CONFIG.recipientName)}</p>`;
  }
}

function escapeHtml(s) {
  const ent = (n) => String.fromCharCode(38) + n + ";";
  return String(s)
    .replace(/&/g, ent("amp"))
    .replace(/</g, ent("lt"))
    .replace(/"/g, ent("quot"));
}

function bindNo(btn) {
  if (!btn) return;
  const threat = (e) => {
    e.preventDefault();
    e.stopPropagation();
    flee(btn);
  };
  btn.addEventListener("pointerenter", threat);
  btn.addEventListener("pointerdown", threat);
  btn.addEventListener("click", (e) => e.preventDefault());
}

function flee(fromBtn) {
  ensureMusic();
  const now = Date.now();
  if (now - lastFlee < 90) return;
  lastFlee = now;
  rapid.push(now);
  while (rapid.length && now - rapid[0] > 900) rapid.shift();
  if (rapid.length >= 4) {
    els.secret.classList.remove("hidden");
    setTimeout(() => els.secret.classList.add("hidden"), 2600);
    rapid.length = 0;
  }
  state.attempts += 1;
  state.phrase = NO_PHRASES[Math.min(state.attempts - 1, NO_PHRASES.length - 1)];
  state.quip = SIDE_QUIPS[state.attempts % SIDE_QUIPS.length];

  const yes = document.getElementById("yes")?.getBoundingClientRect();
  const w = fromBtn.offsetWidth || 128;
  const h = fromBtn.offsetHeight || 52;
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = pad;
  let y = pad;
  for (let i = 0; i < 48; i += 1) {
    x = pad + Math.random() * Math.max(8, vw - w - pad * 2);
    y = pad + Math.random() * Math.max(8, vh - h - pad * 2);
    if (!yes) break;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const ox = Math.abs(cx - (yes.left + yes.width / 2)) < yes.width / 2 + w / 2 + 28;
    const oy = Math.abs(cy - (yes.top + yes.height / 2)) < yes.height / 2 + h / 2 + 28;
    if (!(ox && oy)) break;
  }
  x = Math.min(Math.max(pad, x), vw - w - pad);
  y = Math.min(Math.max(pad, y), vh - h - pad);

  const flo = els.noFloat;
  flo.textContent = state.attempts >= 10 ? "Всё равно НЕТ 😤" : "Нет 😤";
  flo.classList.remove("hidden");
  flo.classList.add("fixed");
  flo.style.left = x + "px";
  flo.style.top = y + "px";
  render();
}

els.noFloat.addEventListener("pointerenter", (e) => {
  e.preventDefault();
  flee(els.noFloat);
});
els.noFloat.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  flee(els.noFloat);
});
els.noFloat.addEventListener("click", (e) => e.preventDefault());

function onYes() {
  ensureMusic();
  burst();
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  state.screen = "loved";
  els.noFloat.classList.add("hidden");
  render();
}

function burst() {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ["#FF4F81", "#9B5DE5", "#FF365C", "#FFD166", "#FFFFFF", "#FF7EB3"];
  const glyphs = ["❤", "✨", "💕", "💗"];
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const parts = Array.from({ length: 46 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 46 + Math.random();
    const s = 3 + Math.random() * 7;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 4,
      g: 0.12 + Math.random() * 0.08,
      life: 1,
      color: colors[i % colors.length],
      glyph: glyphs[i % glyphs.length],
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.2,
      heart: i % 2 === 0,
    };
  });
  let frame = 0;
  const tick = () => {
    frame += 1;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.life -= 0.012;
      p.rot += p.vr;
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.heart) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = "18px serif";
        ctx.fillText(p.glyph, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 6, 10);
      }
    }
    ctx.globalAlpha = 1;
    if (frame < 120) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(tick);
}

function spawnHearts() {
  const glyphs = ["❤", "💗", "✨", "🌸", "💕"];
  for (let i = 0; i < 26; i += 1) {
    const s = document.createElement("span");
    s.className = "float-heart";
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = (i * 37) % 100 + "%";
    s.style.fontSize = 12 + (i % 18) + "px";
    s.style.animationDelay = ((i * 0.47) % 14) + "s";
    s.style.animationDuration = 11 + (i % 9) + "s";
    s.style.opacity = String(0.28 + (i % 5) * 0.1);
    s.style.setProperty("--drift", -40 + ((i * 13) % 80) + "px");
    s.style.setProperty("--spin", (i % 2 === 0 ? 280 : -240) + "deg");
    els.hearts.appendChild(s);
  }
}

function playRomance() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { stop() {} };
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.07;
  master.connect(ctx.destination);
  const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23];
  let i = 0;
  let alive = true;
  const strike = () => {
    if (!alive) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = notes[i % notes.length];
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.15);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 1.2);
    i += 1;
  };
  strike();
  const id = setInterval(strike, 640);
  return {
    stop() {
      alive = false;
      clearInterval(id);
      ctx.close();
    },
  };
}

function ensureMusic() {
  if (!CONFIG.musicEnabled || musicStarted || state.muted) return;
  musicStarted = true;
  musicCtl = playRomance();
}

els.mute.addEventListener("click", () => {
  state.muted = !state.muted;
  els.mute.textContent = state.muted ? "🔇" : "🔊";
  if (state.muted) {
    musicCtl?.stop();
    musicCtl = null;
    musicStarted = false;
  }
});
if (!CONFIG.musicEnabled) els.mute.classList.add("hidden");

setTimeout(() => {
  state.line = 1;
  render();
}, 700);
setTimeout(() => {
  state.line = 2;
  render();
}, 1500);
setTimeout(() => {
  state.showQuestion = true;
  render();
}, 2300);

spawnHearts();
render();
