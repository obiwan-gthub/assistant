const MODULE_PAGES = {
  clock: "clock",
  weather: "weather",
  ai: "assistant",
  audio_test: "audio_test",
};

const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const PAGE_ORDER = ["clock", "weather", "assistant", "audio_test"];
const PAGE_ANIM_MS = 520;

let activePage = "clock";
let weatherIntervalId = null;
let mediaRecorder = null;
let recordedChunks = [];
let pageAnimTimer = null;
let typeTimer = null;
let weatherAnimFrame = null;

const DUST_COLORS = ["#58a6ff", "#f0f6fc", "#a371f7", "#3fb950", "#8b949e"];
const WEATHER_ICONS = [
  ["orage", "i-storm"],
  ["pluie", "i-rain"],
  ["neige", "i-snow"],
  ["brouillard", "i-fog"],
  ["couvert", "i-cloud"],
  ["nuage", "i-cloud-sun"],
  ["dégagé", "i-sun"],
  ["degage", "i-sun"],
];

const wsStatusEl = document.getElementById("ws-status");
const wsLabelEl = document.getElementById("ws-label");
const navBar = document.getElementById("nav-bar");
const navIndicator = document.getElementById("nav-indicator");
const audioLogEl = document.getElementById("audio-log");
const dustCanvas = document.getElementById("dust-canvas");
const dustCtx = dustCanvas.getContext("2d");
const weatherIconUse = document.getElementById("weather-icon-use");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let dustParticles = [];
let dustFrame = null;

function syncDustCanvas() {
  const host = document.getElementById("pages");
  const rect = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  dustCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  dustCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function disintegrate(element) {
  if (prefersReducedMotion || !element) {
    return;
  }

  syncDustCanvas();
  const hostRect = document.getElementById("pages").getBoundingClientRect();
  const target = element.querySelector(".card, .clock-scene") || element;
  const rect = target.getBoundingClientRect();
  const originX = rect.left - hostRect.left;
  const originY = rect.top - hostRect.top;
  const cols = 18;
  const rows = 12;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (Math.random() > 0.85) {
        continue;
      }
      const x = originX + ((col + Math.random()) / cols) * rect.width;
      const y = originY + ((row + Math.random()) / rows) * rect.height;
      dustParticles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5.5,
        vy: -1.4 + Math.random() * 2.2,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        size: 2 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        color: DUST_COLORS[(row + col) % DUST_COLORS.length],
      });
    }
  }

  if (dustParticles.length > 420) {
    dustParticles = dustParticles.slice(-420);
  }
  if (!dustFrame) {
    dustFrame = requestAnimationFrame(drawDust);
  }
}

function drawDust() {
  const width = dustCanvas.clientWidth;
  const height = dustCanvas.clientHeight;
  dustCtx.clearRect(0, 0, width, height);

  dustParticles = dustParticles.filter((particle) => particle.life > 0);
  dustParticles.forEach((particle) => {
    particle.vy += 0.14;
    particle.vx *= 0.99;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.rot += particle.vr;
    particle.life -= particle.decay;

    dustCtx.save();
    dustCtx.globalAlpha = Math.max(particle.life, 0);
    dustCtx.translate(particle.x, particle.y);
    dustCtx.rotate(particle.rot);
    dustCtx.fillStyle = particle.color;
    const size = particle.size * particle.life;
    dustCtx.fillRect(-size / 2, -size / 2, size, size);
    dustCtx.restore();
  });

  if (dustParticles.length) {
    dustFrame = requestAnimationFrame(drawDust);
  } else {
    dustFrame = null;
    dustCtx.clearRect(0, 0, width, height);
  }
}

function bump(el, className) {
  if (!el) {
    return;
  }
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function updateNavIndicator(pageId) {
  const button = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (!button || !navIndicator) {
    return;
  }
  navIndicator.style.width = `${button.offsetWidth}px`;
  navIndicator.style.transform = `translateX(${button.offsetLeft}px)`;
}

function showPage(pageId) {
  if (pageId === activePage) {
    updateNavIndicator(pageId);
    onPageShow(pageId);
    return;
  }

  const goingRight = PAGE_ORDER.indexOf(pageId) > PAGE_ORDER.indexOf(activePage);
  const outgoing = document.getElementById(`page-${activePage}`);
  const incoming = document.getElementById(`page-${pageId}`);
  activePage = pageId;

  if (pageAnimTimer) {
    clearTimeout(pageAnimTimer);
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("from-left", "from-right", "to-left", "to-right", "ash");
  });

  if (outgoing) {
    outgoing.classList.remove("active", "hidden");
    outgoing.classList.add("ash");
    disintegrate(outgoing);
  }

  incoming.classList.remove("hidden");
  incoming.classList.add("active", goingRight ? "from-right" : "from-left");

  pageAnimTimer = setTimeout(() => {
    document.querySelectorAll(".page").forEach((page) => {
      if (!page.classList.contains("active")) {
        page.classList.add("hidden");
        page.classList.remove("to-left", "to-right", "from-left", "from-right", "ash");
      }
    });
  }, PAGE_ANIM_MS);

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });
  updateNavIndicator(pageId);
  onPageShow(pageId);
}

function onPageShow(pageId) {
  if (pageId === "weather") {
    refreshWeather();
    startWeatherInterval();
  } else {
    stopWeatherInterval();
  }

  if (pageId === "audio_test") {
    loadAudioLog();
  }
}

function startWeatherInterval() {
  stopWeatherInterval();
  weatherIntervalId = setInterval(refreshWeather, WEATHER_REFRESH_MS);
}

function stopWeatherInterval() {
  if (weatherIntervalId !== null) {
    clearInterval(weatherIntervalId);
    weatherIntervalId = null;
  }
}

function setWsStatus(connected) {
  wsLabelEl.textContent = connected ? "Connecté" : "Hors ligne";
  wsStatusEl.classList.toggle("ws-connected", connected);
  wsStatusEl.classList.toggle("ws-disconnected", !connected);
}

function setRecordLabel(button, label) {
  const labelEl = button.querySelector(".record-label");
  if (labelEl) {
    labelEl.textContent = label;
  }
}

function weatherIconId(description) {
  const text = (description || "").toLowerCase();
  const match = WEATHER_ICONS.find(([word]) => text.includes(word));
  return match ? match[1] : "i-cloud-sun";
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!message) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("shake");
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
  bump(el, "shake");
}

function renderFlipClock(timeStr) {
  const clockEl = document.getElementById("clock");
  const chars = String(timeStr).split("");
  const template = chars.map((ch) => (ch === ":" ? ":" : "0")).join("");

  if (clockEl.dataset.template !== template) {
    clockEl.innerHTML = chars
      .map((ch) =>
        ch === ":"
          ? `<span class="clock-sep">:</span>`
          : `<span class="clock-flip"><span class="clock-face">${ch}</span></span>`
      )
      .join("");
    clockEl.dataset.template = template;
    clockEl.dataset.value = timeStr;
    clockEl.setAttribute("aria-label", timeStr);
    return;
  }

  const faces = clockEl.querySelectorAll(".clock-flip");
  let digitIndex = 0;
  chars.forEach((ch) => {
    if (ch === ":") {
      return;
    }
    const flip = faces[digitIndex];
    digitIndex += 1;
    const face = flip.querySelector(".clock-face");
    if (face.textContent === ch) {
      return;
    }
    face.textContent = ch;
    if (!prefersReducedMotion) {
      bump(flip, "flip");
    }
  });
  clockEl.dataset.value = timeStr;
  clockEl.setAttribute("aria-label", timeStr);
}

function updateClockDisplay(time, date) {
  if (time) {
    renderFlipClock(time);
  }
  if (!date) {
    return;
  }
  const dateEl = document.getElementById("date");
  if (dateEl.textContent !== date) {
    dateEl.textContent = date;
    bump(dateEl.parentElement, "pop");
  }
}

function setWeatherValues(temperature, description) {
  const tempEl = document.getElementById("weather-temp");
  const descEl = document.getElementById("weather-desc");
  const next = Number(temperature);
  const prev = Number(tempEl.dataset.value);

  tempEl.dataset.value = Number.isFinite(next) ? String(next) : "";

  if (weatherAnimFrame) {
    cancelAnimationFrame(weatherAnimFrame);
    weatherAnimFrame = null;
  }

  if (!prefersReducedMotion && Number.isFinite(prev) && Number.isFinite(next) && prev !== next) {
    const start = performance.now();
    const duration = 700;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      tempEl.textContent = `${(prev + (next - prev) * eased).toFixed(1)}°C`;
      if (t < 1) {
        weatherAnimFrame = requestAnimationFrame(step);
      }
    };
    weatherAnimFrame = requestAnimationFrame(step);
  } else {
    tempEl.textContent = `${temperature}°C`;
  }

  bump(tempEl, "pop");
  const iconId = weatherIconId(description);
  if (weatherIconUse.getAttribute("href") !== `#${iconId}`) {
    weatherIconUse.setAttribute("href", `#${iconId}`);
    bump(document.getElementById("weather-glyph"), "swap");
  }
  if (descEl.textContent !== description) {
    descEl.textContent = description;
    bump(descEl, "fade-up");
  }
}

function typeText(el, text) {
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = null;
  }

  if (prefersReducedMotion || !text) {
    el.classList.remove("typing");
    el.textContent = text;
    return;
  }

  el.textContent = "";
  el.classList.add("typing");
  let index = 0;
  const tick = () => {
    index += 2;
    el.textContent = text.slice(0, index);
    if (index < text.length) {
      typeTimer = setTimeout(tick, 16);
    } else {
      el.classList.remove("typing");
      typeTimer = null;
    }
  };
  tick();
}

async function refreshWeather() {
  if (activePage !== "weather") {
    return;
  }

  try {
    const response = await fetch("/ask?q=météo");
    const data = await response.json();

    if (data.error) {
      showError("weather-error", data.error);
      return;
    }

    showError("weather-error", null);
    setWeatherValues(data.temperature, data.description);
  } catch (err) {
    showError("weather-error", "Impossible de contacter le serveur.");
    console.error(err);
  }
}

function renderAssistantResult(data) {
  const questionEl = document.getElementById("assistant-question-text");
  const answerEl = document.getElementById("assistant-answer");

  if (data.error) {
    showError("assistant-error", data.error);
    return;
  }

  showError("assistant-error", null);

  if (data.question) {
    questionEl.textContent = data.question;
    bump(questionEl, "fade-up");
  }
  if (data.answer) {
    typeText(answerEl, data.answer);
  }
}

function createAudioItem(entry, delayMs = 0) {
  const item = document.createElement("li");
  item.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-wave"></use></svg>';
  const time = document.createElement("span");
  time.className = "timestamp";
  time.textContent = entry.timestamp || "";
  const text = document.createElement("span");
  text.textContent = entry.text || "";
  item.append(time, text);
  if (delayMs) {
    item.style.animationDelay = `${delayMs}ms`;
  }
  return item;
}

function prependAudioEntry(entry) {
  audioLogEl.prepend(createAudioItem(entry));
}

function renderAudioLog(messages) {
  audioLogEl.innerHTML = "";
  messages.forEach((entry, index) => {
    audioLogEl.append(createAudioItem(entry, index * 60));
  });
}

async function loadAudioLog() {
  try {
    const response = await fetch("/audio-log");
    const data = await response.json();
    renderAudioLog(data.messages || []);
  } catch (err) {
    console.error(err);
  }
}

async function sendRecording() {
  const blob = new Blob(recordedChunks, { type: "audio/wav" });
  const formData = new FormData();
  formData.append("file", blob, "recording.wav");

  const response = await fetch("/voice", { method: "POST", body: formData });
  const data = await response.json();

  if (data.module === "ai" || data.answer) {
    renderAssistantResult(data);
    if (activePage !== "assistant") {
      showPage("assistant");
    }
  }

  return data;
}

async function toggleRecording(button) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    button.disabled = true;
    button.classList.remove("recording");
    button.classList.add("processing");
    setRecordLabel(button, "Traitement...");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      try {
        await sendRecording();
      } catch (err) {
        showError("assistant-error", "Erreur lors de l'envoi audio.");
        console.error(err);
      } finally {
        button.disabled = false;
        button.classList.remove("processing", "recording");
        setRecordLabel(button, "Enregistrer");
      }
    };

    mediaRecorder.start();
    button.classList.add("recording");
    setRecordLabel(button, "Arrêter");
  } catch (err) {
    showError("assistant-error", "Microphone inaccessible.");
    console.error(err);
  }
}

function handleModuleResult(data) {
  const pageId = MODULE_PAGES[data.module];
  if (!pageId) {
    return;
  }

  if (data.module === "weather") {
    if (data.error) {
      showError("weather-error", data.error);
    } else {
      showError("weather-error", null);
      setWeatherValues(data.temperature, data.description);
    }
  }

  if (data.module === "ai") {
    renderAssistantResult(data);
  }

  if (data.module === "clock") {
    updateClockDisplay(data.time || data.value, data.date);
  }

  if (activePage !== pageId) {
    showPage(pageId);
  }
}

const ws = new WebSocket(`ws://${location.host}/ws`);

ws.onopen = () => setWsStatus(true);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "clock") {
    updateClockDisplay(data.value, data.date);
    return;
  }

  if (data.type === "audio_message") {
    prependAudioEntry(data);
    return;
  }

  if (data.type === "module_result") {
    handleModuleResult(data);
  }
};

ws.onclose = () => {
  setWsStatus(false);
  console.log("Connexion perdue, tentative de reconnexion dans 3s...");
  setTimeout(() => location.reload(), 3000);
};

navBar.addEventListener("click", (event) => {
  const button = event.target.closest(".nav-btn");
  if (!button) {
    return;
  }
  showPage(button.dataset.page);
});

document.getElementById("record-btn-assistant").addEventListener("click", (event) => {
  toggleRecording(event.currentTarget);
});

document.getElementById("record-btn-test").addEventListener("click", (event) => {
  toggleRecording(event.currentTarget);
});

document.addEventListener("keydown", (event) => {
  const shortcuts = { 1: "clock", 2: "weather", 3: "assistant", 4: "audio_test" };
  if (shortcuts[event.key]) {
    showPage(shortcuts[event.key]);
  }
});

setWsStatus(false);
updateClockDisplay("--:--:--", "");
requestAnimationFrame(() => {
  updateNavIndicator(activePage);
  syncDustCanvas();
});
window.addEventListener("resize", () => {
  updateNavIndicator(activePage);
  syncDustCanvas();
});
