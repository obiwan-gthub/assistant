from abc import ABC, abstractmethod


class Module(ABC):
    name: str = "base"

    @abstractmethod
    def can_handle(self, query: str) -> bool:
        """Return True if this module can handle the query."""

    @abstractmethod
    def run(self, query: str) -> dict:
        """Execute and return a JSON-serializable dict for the frontend."""
