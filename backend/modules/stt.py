_model = None


def _get_model():
    global _model
    if _model is None:
        import whisper

        _model = whisper.load_model("tiny")
    return _model


def transcribe(path_wav: str) -> str:
    result = _get_model().transcribe(path_wav, language="fr")
    return result["text"].strip()
