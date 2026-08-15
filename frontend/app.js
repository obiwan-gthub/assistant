const MODULE_PAGES = {
  clock: "clock",
  weather: "weather",
  ai: "assistant",
  audio_test: "audio_test",
};

const WEATHER_REFRESH_MS = 10 * 60 * 1000;

let activePage = "clock";
let weatherIntervalId = null;
let mediaRecorder = null;
let recordedChunks = [];

const wsStatusEl = document.getElementById("ws-status");
const navBar = document.getElementById("nav-bar");
const audioLogEl = document.getElementById("audio-log");

function showPage(pageId) {
  activePage = pageId;

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("hidden", page.id !== `page-${pageId}`);
    page.classList.toggle("active", page.id === `page-${pageId}`);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

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
  wsStatusEl.textContent = connected ? "Connecté" : "Hors ligne";
  wsStatusEl.classList.toggle("ws-connected", connected);
  wsStatusEl.classList.toggle("ws-disconnected", !connected);
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!message) {
    el.textContent = "";
    el.classList.add("hidden");
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

async function refreshWeather() {
  if (activePage !== "weather") {
    return;
  }

  const tempEl = document.getElementById("weather-temp");
  const descEl = document.getElementById("weather-desc");

  try {
    const response = await fetch("/ask?q=météo");
    const data = await response.json();

    if (data.error) {
      showError("weather-error", data.error);
      return;
    }

    showError("weather-error", null);
    tempEl.textContent = `${data.temperature}°C`;
    descEl.textContent = data.description;
  } catch (err) {
    showError("weather-error", "Impossible de contacter le serveur.");
    console.error(err);
  }
}

function renderAssistantResult(data) {
  const questionEl = document.getElementById("assistant-question");
  const answerEl = document.getElementById("assistant-answer");

  if (data.error) {
    showError("assistant-error", data.error);
    return;
  }

  showError("assistant-error", null);

  if (data.question) {
    questionEl.textContent = data.question;
  }
  if (data.answer) {
    answerEl.textContent = data.answer;
  }
}

function prependAudioEntry(entry) {
  const item = document.createElement("li");
  const time = document.createElement("span");
  time.className = "timestamp";
  time.textContent = entry.timestamp || "";
  const text = document.createElement("span");
  text.textContent = entry.text || "";
  item.append(time, text);
  audioLogEl.prepend(item);
}

function renderAudioLog(messages) {
  audioLogEl.innerHTML = "";
  messages.forEach((entry) => prependAudioEntry(entry));
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
    button.textContent = "Traitement...";
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
        button.textContent = "Enregistrer";
      }
    };

    mediaRecorder.start();
    button.classList.add("recording");
    button.textContent = "Arrêter";
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
      document.getElementById("weather-temp").textContent = `${data.temperature}°C`;
      document.getElementById("weather-desc").textContent = data.description;
    }
  }

  if (data.module === "ai") {
    renderAssistantResult(data);
  }

  if (data.module === "clock") {
    document.getElementById("clock").textContent = data.time || data.value;
    if (data.date) {
      document.getElementById("date").textContent = data.date;
    }
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
    document.getElementById("clock").textContent = data.value;
    if (data.date) {
      document.getElementById("date").textContent = data.date;
    }
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
