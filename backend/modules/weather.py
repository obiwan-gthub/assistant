import os

import requests

from .base import Module

LAT = float(os.environ.get("LAT", "48.8566"))
LON = float(os.environ.get("LON", "2.3522"))

WEATHER_CODES = {
    0: "Ciel dégagé",
    1: "Plutôt dégagé",
    2: "Partiellement nuageux",
    3: "Couvert",
    45: "Brouillard",
    61: "Pluie légère",
    63: "Pluie",
    71: "Neige légère",
    95: "Orage",
}


class WeatherModule(Module):
    name = "weather"

    def can_handle(self, query: str) -> bool:
        keywords = ("météo", "meteo", "temps", "température", "il fait")
        lowered = query.lower()
        return any(keyword in lowered for keyword in keywords)

    def run(self, query: str) -> dict:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={LAT}&longitude={LON}"
            "&current=temperature_2m,weather_code"
        )
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            data = response.json()["current"]
        except requests.RequestException as exc:
            return {"error": f"Impossible de récupérer la météo : {exc}"}

        code = data["weather_code"]
        return {
            "temperature": data["temperature_2m"],
            "description": WEATHER_CODES.get(code, "Inconnu"),
        }
