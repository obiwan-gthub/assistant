import sounddevice as sd
from scipy.io.wavfile import write

FS = 16000  # fréquence d'échantillonnage adaptée à Whisper
DURATION = 5

print("Enregistrement...")
audio = sd.rec(int(DURATION * FS), samplerate=FS, channels=1, dtype="int16")
sd.wait()
write("test.wav", FS, audio)
print("Terminé, fichier test.wav créé.")