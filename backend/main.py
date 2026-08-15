import asyncio
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from modules.ai import AIModule
from modules.audio_test import AudioTestModule
from modules.clock import ClockModule
from modules.registry import ModuleRegistry
from modules.weather import WeatherModule

clock_module = ClockModule()
weather_module = WeatherModule()
audio_test_module = AudioTestModule()
ai_module = AIModule()

registry = ModuleRegistry()
registry.register(clock_module)
registry.register(weather_module)
registry.register(audio_test_module)
registry.register(ai_module)

_connections: set[WebSocket] = set()


async def broadcast(message: dict) -> None:
    stale: list[WebSocket] = []
    for websocket in list(_connections):
        try:
            await websocket.send_json(message)
        except Exception:
            stale.append(websocket)
    for websocket in stale:
        _connections.discard(websocket)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="../frontend"), name="static")


@app.get("/")
async def index():
    return FileResponse("../frontend/index.html")


@app.get("/ask")
async def ask(q: str):
    result = registry.dispatch(q)
    if result:
        return result
    return {"error": "Aucun module ne sait répondre à ça"}


@app.get("/audio-log")
async def audio_log():
    return audio_test_module.run("")


@app.post("/voice")
async def voice(file: UploadFile):
    from modules.stt import transcribe

    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_path = temp_file.name
            contents = await file.read()
            temp_file.write(contents)

        question = transcribe(temp_path)
        entry = audio_test_module.record(question)
        await broadcast({"type": "audio_message", **entry})

        result = registry.dispatch(question)
        if result is None:
            result = {"module": ai_module.name, **ai_module.run(question)}

        await broadcast({"type": "module_result", **result})
        return {"question": question, **result}
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _connections.add(websocket)
    try:
        while True:
            clock_data = clock_module.run("")
            await websocket.send_json(
                {
                    "type": "clock",
                    "module": clock_module.name,
                    "value": clock_data["time"],
                    "date": clock_data["date"],
                }
            )
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(websocket)
