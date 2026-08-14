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