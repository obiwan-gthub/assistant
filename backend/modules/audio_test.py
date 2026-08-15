import datetime
from collections import deque

from .base import Module

_MAX_HISTORY = 50


class AudioTestModule(Module):
    name = "audio_test"

    def __init__(self):
        self._history: deque[dict] = deque(maxlen=_MAX_HISTORY)

    def can_handle(self, query: str) -> bool:
        keywords = ("test", "test micro", "debug audio")
        lowered = query.lower()
        return any(keyword in lowered for keyword in keywords)

    def record(self, text: str) -> dict:
        entry = {
            "text": text,
            "timestamp": datetime.datetime.now().isoformat(timespec="seconds"),
        }
        self._history.appendleft(entry)
        return entry

    def run(self, query: str) -> dict:
        return {"messages": list(self._history)[:20]}
