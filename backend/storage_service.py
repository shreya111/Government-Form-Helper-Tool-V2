"""Object storage adapter. Emergent-managed S3-compatible storage is the active provider;
the StorageService interface keeps the rest of the app provider-agnostic (S3/GCS/Azure later)."""
import os
import logging
from abc import ABC, abstractmethod

import requests

logger = logging.getLogger(__name__)

_STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
_STORAGE_URL = _STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")


class StorageService(ABC):
    @abstractmethod
    def init(self, force: bool = False) -> None: ...

    @abstractmethod
    def put(self, path: str, data: bytes, content_type: str) -> dict: ...

    @abstractmethod
    def get(self, path: str) -> tuple[bytes, str]: ...


class EmergentStorageService(StorageService):
    def __init__(self):
        self._key = None

    def init(self, force: bool = False) -> None:
        if self._key and not force:
            return
        resp = requests.post(f"{_STORAGE_URL}/init", json={"emergent_key": _EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        self._key = resp.json()["storage_key"]

    def put(self, path: str, data: bytes, content_type: str) -> dict:
        self.init()
        resp = requests.put(
            f"{_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": self._key, "Content-Type": content_type},
            data=data, timeout=120,
        )
        if resp.status_code == 404:  # stale key -> mint a fresh one once
            self.init(force=True)
            resp = requests.put(
                f"{_STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": self._key, "Content-Type": content_type},
                data=data, timeout=120,
            )
        resp.raise_for_status()
        return resp.json()

    def get(self, path: str) -> tuple[bytes, str]:
        self.init()
        resp = requests.get(
            f"{_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": self._key}, timeout=60,
        )
        if resp.status_code == 404:
            self.init(force=True)
            resp = requests.get(
                f"{_STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": self._key}, timeout=60,
            )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


storage = EmergentStorageService()
