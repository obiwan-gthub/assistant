# Assistant personnel Raspberry Pi — Guide de projet père/fils

Objectif : un assistant sur Raspberry Pi, écran TFT, micro, interface HTML/CSS moderne, architecture modulaire (météo + IA pour démarrer). Toi tu maîtrises déjà la technique — ce guide est pensé pour te servir de trame pédagogique avec ton fils, avec à chaque étape une piste sur *quoi lui faire faire* et *quoi lui expliquer*, plus le code à implémenter.

Principe général de répartition : **toi tu prépares/débloques, lui il branche/teste/voit le résultat**. Dès qu'un test visuel ou physique est possible, c'est pour lui. Pour le code, laisse-le taper pendant que tu dictes l'intention plutôt que la syntaxe.

---

## 0. Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────┐
│  Raspberry Pi                            │
│                                           │
│  ┌───────────┐     ┌──────────────────┐ │
│  │  Backend   │────▶│  Serveur web      │ │
│  │  Python    │     │  local (FastAPI)  │ │
│  │  (modules) │     └────────┬─────────┘ │
│  └─────┬─────┘              │            │
│        │                    ▼            │
│  ┌─────▼─────┐     ┌──────────────────┐ │
│  │ Micro USB │     │ Chromium kiosk    │ │
│  │ (rotatif) │     │ → écran TFT       │ │
│  └───────────┘     │ (HTML/CSS/JS)     │ │
│                     └──────────────────┘ │
└─────────────────────────────────────────┘
```

- **Backend Python** : orchestrateur + registre de modules (météo, IA, futurs modules).
- **Serveur web local (FastAPI + WebSocket)** : sert l'interface HTML/CSS et pousse les mises à jour en temps réel.
- **Frontend HTML/CSS/JS** : affiché en plein écran (mode kiosk Chromium) sur le TFT.
- **Micro** : capture la voix, déclenche les modules.

Arborescence de projet à cibler dès le départ (à dessiner ensemble) :

```
assistant/
├── backend/
│   ├── main.py            # serveur FastAPI + WebSocket
│   ├── modules/
│   │   ├── base.py        # interface Module
│   │   ├── weather.py
│   │   └── ai.py
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## 1. Matériel à réunir

- Raspberry Pi (4 ou 5, au moins 4 Go de RAM si possible pour le module IA local)
- Carte micro-SD 32 Go+ (classe A2 recommandée)
- Écran TFT SPI (type Waveshare 3.5"/5", ou HDMI si tu veux éviter le driver SPI — voir note ci-dessous)
- Microphone USB (un modèle "conférence" à 360° si tu veux le côté "tournant" pour bien capter la voix ; sinon micro USB simple)
- Alimentation officielle Raspberry Pi
- Boîtier ou support pour tenir l'écran
- Clavier/souris/écran externe pour la configuration initiale

**Choix important** : écran **SPI** (moins cher, driver à installer, rafraîchissement plus lent) vs écran **HDMI officiel** (plug-and-play). Pour un premier projet avec un ado, HDMI officiel conseillé : zéro driver à compiler.

---

## 2. Étape 1 — Découverte et configuration système

**Toi** : expliques ce qu'est un OS embarqué, pourquoi on flashe une carte SD.

**Lui** :
1. Flasher Raspberry Pi OS (64-bit) avec *Raspberry Pi Imager*, SSH + Wi-Fi activés dans les options.
2. Connexion SSH depuis son PC.
3. `sudo apt update && sudo apt upgrade`.
4. Installer les bases Python :
   ```bash
   sudo apt install -y python3-pip python3-venv git
   python3 -m venv ~/assistant-env
   source ~/assistant-env/bin/activate
   pip install gpiozero
   ```

**Code — test LED** (à brancher sur une broche GPIO avec une résistance, ex. GPIO17) :

```python
# led_test.py
from gpiozero import LED
from time import sleep

led = LED(17)

for _ in range(5):
    led.on()
    sleep(0.5)
    led.off()
    sleep(0.5)

print("Test terminé !")
```

```bash
python3 led_test.py
```

**Test de validation** : la LED clignote 5 fois.

---

## 3. Étape 2 — Écran TFT

**Lui** :
1. Brancher l'écran (HDMI = câble direct ; SPI = suivre le pinout du fabricant).
2. Si SPI : `sudo raspi-config` → Interface Options → activer SPI, puis installer le driver fourni par le fabricant (script `.sh` généralement, à lire ensemble ligne par ligne — bonne occasion de comprendre ce qu'un script d'installation fait réellement).
3. Installer et tester Chromium en kiosk :
   ```bash
   sudo apt install -y chromium-browser unclutter
   ```

**Code — page de test HTML** :

```html
<!-- frontend/index.html (version test) -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Assistant</title>
  <style>
    body {
      margin: 0;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
      color: #fff;
      font-family: sans-serif;
      font-size: 3rem;
    }
  </style>
</head>
<body>
  Ça marche !
</body>
</html>
```

**Lancer en kiosk** (depuis le dossier contenant le fichier) :
```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --check-for-update-interval=31536000 \
  file:///home/pi/assistant/frontend/index.html
```

**Test de validation** : "Ça marche !" s'affiche en plein écran sur le TFT.

---

## 4. Étape 3 — Microphone

**Lui** :
1. Vérifier la détection : `arecord -l`
2. Régler le niveau : `alsamixer` (touche F4 pour la capture)
3. Enregistrer et réécouter :
   ```bash
   arecord -D plughw:1,0 -f cd -d 5 test.wav
   aplay test.wav
   ```

**Code — enregistrement en Python** (utile pour la suite, à intégrer au backend) :

```python
# backend/mic_test.py
import sounddevice as sd
from scipy.io.wavfile import write

FS = 16000  # fréquence d'échantillonnage adaptée à Whisper
DURATION = 5

print("Enregistrement...")
audio = sd.rec(int(DURATION * FS), samplerate=FS, channels=1, dtype="int16")
sd.wait()
write("test.wav", FS, audio)
print("Terminé, fichier test.wav créé.")
```

```bash
pip install sounddevice scipy
python3 mic_test.py
```

**Test de validation** : un fichier `.wav` de sa voix, audible en relecture.

---

## 5. Étape 4 — Le serveur web local

**Installation** :
```bash
pip install fastapi "uvicorn[standard]" websockets
```

**Code — serveur minimal avec WebSocket (horloge en direct)** :

```python
# backend/main.py
import asyncio
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/")
async def index():
    return FileResponse("../frontend/index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            now = datetime.datetime.now().strftime("%H:%M:%S")
            await websocket.send_json({"type": "clock", "value": now})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
```

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Code — frontend qui écoute le WebSocket** :

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Assistant</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="clock">--:--:--</div>
  <script src="/static/app.js"></script>
</body>
</html>
```

```css
/* frontend/style.css */
body {
  margin: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d1117;
  color: #f0f6fc;
  font-family: system-ui, sans-serif;
}
#clock {
  font-size: 6rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}
```

```javascript
// frontend/app.js
const ws = new WebSocket(`ws://${location.host}/ws`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "clock") {
    document.getElementById("clock").textContent = data.value;
  }
};

ws.onclose = () => {
  console.log("Connexion perdue, tentative de reconnexion dans 3s...");
  setTimeout(() => location.reload(), 3000);
};
```

**Test de validation** : une horloge qui tourne en direct sur l'écran, sans recharger la page.

---

## 6. Étape 5 — Architecture modulaire

**Code — interface commune** :

```python
# backend/modules/base.py
from abc import ABC, abstractmethod

class Module(ABC):
    name: str = "base"

    @abstractmethod
    def can_handle(self, query: str) -> bool:
        """Renvoie True si ce module sait traiter cette requête."""
        ...

    @abstractmethod
    def run(self, query: str) -> dict:
        """Exécute le module et renvoie un dict JSON-sérialisable
        destiné à être affiché côté frontend."""
        ...
```

**Code — registre de modules** :

```python
# backend/modules/registry.py
from .base import Module

class ModuleRegistry:
    def __init__(self):
        self._modules: list[Module] = []

    def register(self, module: Module):
        self._modules.append(module)

    def dispatch(self, query: str) -> dict | None:
        for module in self._modules:
            if module.can_handle(query):
                return {"module": module.name, **module.run(query)}
        return None
```

**Intégration dans `main.py`** :

```python
from modules.registry import ModuleRegistry
from modules.weather import WeatherModule

registry = ModuleRegistry()
registry.register(WeatherModule())

@app.get("/ask")
async def ask(q: str):
    result = registry.dispatch(q)
    return result or {"error": "Aucun module ne sait répondre à ça"}
```

C'est ici que le "contrat" (interface `Module`) prend tout son sens : chaque nouveau module n'a qu'à respecter `can_handle` / `run` pour se brancher sur le reste.

---

## 7. Étape 6 — Module météo

**Installation** :
```bash
pip install requests
```

**Code — module météo (Open-Meteo, sans clé API)** :

```python
# backend/modules/weather.py
import requests
from .base import Module

# Coordonnées à adapter à votre ville
LAT, LON = 48.8566, 2.3522

WEATHER_CODES = {
    0: "Ciel dégagé", 1: "Plutôt dégagé", 2: "Partiellement nuageux",
    3: "Couvert", 45: "Brouillard", 61: "Pluie légère",
    63: "Pluie", 71: "Neige légère", 95: "Orage",
}

class WeatherModule(Module):
    name = "weather"

    def can_handle(self, query: str) -> bool:
        keywords = ["météo", "temps", "température", "il fait"]
        return any(k in query.lower() for k in keywords)

    def run(self, query: str) -> dict:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={LAT}&longitude={LON}"
            "&current=temperature_2m,weather_code"
        )
        response = requests.get(url, timeout=5)
        data = response.json()["current"]
        code = data["weather_code"]
        return {
            "temperature": data["temperature_2m"],
            "description": WEATHER_CODES.get(code, "Inconnu"),
        }
```

**Code — carte météo côté frontend** (ajouter au `index.html` et au CSS/JS) :

```html
<div id="weather-card" class="card">
  <div id="weather-temp">--°C</div>
  <div id="weather-desc">Chargement...</div>
</div>
```

```css
.card {
  background: #161b22;
  border-radius: 16px;
  padding: 1.5rem 2rem;
  margin-top: 2rem;
  text-align: center;
}
#weather-temp { font-size: 2.5rem; font-weight: 700; }
#weather-desc { opacity: 0.7; }
```

```javascript
async function refreshWeather() {
  const res = await fetch("/ask?q=météo");
  const data = await res.json();
  document.getElementById("weather-temp").textContent = `${data.temperature}°C`;
  document.getElementById("weather-desc").textContent = data.description;
}
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000); // toutes les 10 min
```

**Test de validation** : la carte météo affiche la température réelle et se rafraîchit toute seule.

---

## 8. Étape 7 — Module IA

Trois briques séparées pour que ce ne soit jamais une boîte noire.

### 7a. Voix → texte (Whisper local, léger)

```bash
pip install openai-whisper
```

```python
# backend/modules/stt.py
import whisper

_model = whisper.load_model("tiny")  # "base" si le Pi tient la charge

def transcribe(path_wav: str) -> str:
    result = _model.transcribe(path_wav, language="fr")
    return result["text"].strip()
```

### 7b. Le "cerveau" (appel à l'API Claude)

```bash
pip install anthropic
```

```python
# backend/modules/brain.py
import os
from anthropic import Anthropic

client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def ask_ai(question: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": question}],
    )
    return response.content[0].text
```

### 7c. Module IA complet (branche STT + cerveau, respecte l'interface `Module`)

```python
# backend/modules/ai.py
from .base import Module
from .stt import transcribe
from .brain import ask_ai

class AIModule(Module):
    name = "ai"

    def can_handle(self, query: str) -> bool:
        return True  # module "par défaut" si rien d'autre ne matche

    def run(self, query: str) -> dict:
        answer = ask_ai(query)
        return {"question": query, "answer": answer}
```

**Route dédiée pour l'enregistrement vocal** (reçoit un fichier audio, transcrit, puis répond) :

```python
# ajout dans main.py
from fastapi import UploadFile
from modules.stt import transcribe
from modules.ai import AIModule

ai_module = AIModule()

@app.post("/voice")
async def voice(file: UploadFile):
    contents = await file.read()
    with open("input.wav", "wb") as f:
        f.write(contents)
    question = transcribe("input.wav")
    result = registry.dispatch(question) or ai_module.run(question)
    return {"question": question, **result}
```

### 7d. Texte → voix (optionnel, à ajouter une fois le reste stable)

```bash
pip install piper-tts
```

```python
# backend/modules/tts.py
import subprocess

def speak(text: str, out_path: str = "response.wav"):
    subprocess.run(
        ["piper", "--model", "fr_FR-siwis-medium", "--output_file", out_path],
        input=text.encode(),
    )
    subprocess.run(["aplay", out_path])
```

**Test de validation** : il parle dans le micro (enregistré via `mic_test.py` puis envoyé à `/voice`), la question et la réponse s'affichent à l'écran.

---

## 9. Étape 8 — Finitions et démarrage automatique

**Code — service systemd pour le backend** :

```ini
# /etc/systemd/system/assistant-backend.service
[Unit]
Description=Assistant backend
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/assistant/backend
Environment="ANTHROPIC_API_KEY=votre_cle"
ExecStart=/home/pi/assistant-env/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable assistant-backend
sudo systemctl start assistant-backend
```

**Code — lancement du kiosk au démarrage graphique** (fichier autostart) :

```ini
# ~/.config/autostart/assistant-kiosk.desktop
[Desktop Entry]
Type=Application
Name=Assistant Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:8000
```

**Test de validation final** : redémarrage complet du Pi → l'assistant se lance seul, écran + météo + micro fonctionnels sans intervention manuelle.

---

## Répartition suggérée sur plusieurs séances

| Séance | Contenu | Qui code |
|---|---|---|
| 1 | Archi + flash OS + LED GPIO | Lui, toi guides |
| 2 | Écran + kiosk | Lui, toi guides |
| 3 | Micro + tests audio | Lui |
| 4 | Serveur web + WebSocket horloge | Binôme, alterner qui tape |
| 5 | Design de l'interface module (base.py, registry.py) | Ensemble au tableau, puis lui code |
| 6 | Module météo | Lui, toi review |
| 7-8 | Module IA (STT, cerveau, TTS — une brique par séance) | Binôme, une brique par séance |
| 9 | systemd + autostart + démo | Ensemble |

Chaque séance doit se terminer par un test visible et satisfaisant — c'est ce qui évite l'ennui plus que la difficulté du contenu elle-même.