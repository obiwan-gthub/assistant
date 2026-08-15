import subprocess


def speak(text: str, out_path: str = "response.wav") -> None:
    subprocess.run(
        ["piper", "--model", "fr_FR-siwis-medium", "--output_file", out_path],
        input=text.encode(),
        check=False,
    )
    subprocess.run(["aplay", out_path], check=False)
