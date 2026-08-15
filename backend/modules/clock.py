import datetime

from .base import Module

_DAYS = (
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"
)
_MONTHS = (
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
)


def _format_date_fr(now: datetime.datetime) -> str:
    day_name = _DAYS[now.weekday()]
    month_name = _MONTHS[now.month - 1]
    return f"{day_name} {now.day} {month_name} {now.year}"


class ClockModule(Module):
    name = "clock"

    def can_handle(self, query: str) -> bool:
        keywords = ("heure", "time", "quelle heure", "il est")
        lowered = query.lower()
        return any(keyword in lowered for keyword in keywords)

    def run(self, query: str) -> dict:
        now = datetime.datetime.now()
        return {
            "time": now.strftime("%H:%M:%S"),
            "date": _format_date_fr(now),
        }
