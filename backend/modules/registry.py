from .base import Module


class ModuleRegistry:
    def __init__(self):
        self._modules: list[Module] = []

    def register(self, module: Module) -> None:
        self._modules.append(module)

    def dispatch(self, query: str) -> dict | None:
        for module in self._modules:
            if module.can_handle(query):
                return {"module": module.name, **module.run(query)}
        return None
