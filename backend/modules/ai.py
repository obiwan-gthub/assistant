from .base import Module
from .brain import ask_ai


class AIModule(Module):
    name = "ai"

    def can_handle(self, query: str) -> bool:
        return True

    def run(self, query: str) -> dict:
        answer = ask_ai(query)
        return {"question": query, "answer": answer}
