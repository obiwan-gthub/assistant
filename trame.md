# Install Raspberry Pi OS

```bash
sudo apt install rpi-imager
```

- Lancer `rpi-imager`
- Choisir **Raspberry Pi OS (64-bit)**
- Options : définir username, clavier, SSH, Wi-Fi

# Configuration Raspberry

Se connecter en SSH, puis :

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv git portaudio19-dev libportaudio2
python3 -m venv ~/assistant-env
source ~/assistant-env/bin/activate
pip install gpiozero sounddevice scipy
```

# Créer le projet

Créer les répertoires `frontend` et `backend`.

# Frontend

Page de test :

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

Lancer en plein écran (kiosk) :

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --check-for-update-interval=31536000 \
  file:///home/pi/assistant/frontend/index.html
```

# Backend

## Test micro (ALSA)

```bash
arecord -l
arecord -D plughw:1,0 -f cd -d 5 test.wav
aplay test.wav
```

> Adapter `plughw:1,0` selon la sortie de `arecord -l`.

## Test micro (Python)

```python
# backend/tests/mic_test.py
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
source ~/assistant-env/bin/activate
python backend/tests/mic_test.py
aplay test.wav
```

## Serveur web local


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
