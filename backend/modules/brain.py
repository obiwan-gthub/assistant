import os

from anthropic import Anthropic

_client = None


def _get_client() -> Anthropic | None:
    global _client
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    if _client is None:
        _client = Anthropic(api_key=api_key)
    return _client


def ask_ai(question: str) -> str:
    client = _get_client()
    if client is None:
        return "Clé API Anthropic non configurée."

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            messages=[{"role": "user", "content": question}],
        )
        return response.content[0].text
    except Exception as exc:
        return f"Erreur lors de l'appel à l'IA : {exc}"
