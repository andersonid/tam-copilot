"""Async client for the Red Hat Product Lifecycle API (public, no auth).

Provides product support phase data: GA, Full Support, Maintenance,
EUS, and Extended Life dates for each product version.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger("tam_copilot.lifecycle")


class LifecycleClient:
    """Thin async wrapper over the public Product Lifecycle API."""

    def __init__(self, base_url: str, http: httpx.AsyncClient):
        self._base = base_url.rstrip("/")
        self._http = http

    async def _get(self, path: str, params: dict | None = None) -> Any:
        url = f"{self._base}{path}"
        resp = await self._http.get(url, params=params, headers={"Accept": "application/json"})
        if resp.status_code >= 400:
            logger.error("lifecycle GET %s -> %d", path, resp.status_code)
            return {"error": True, "status": resp.status_code}
        return resp.json()

    async def get_product(self, product_name: str) -> dict | None:
        """Get lifecycle phases for a product by official name."""
        data = await self._get("/products", params={"name": product_name})
        if isinstance(data, dict) and data.get("error"):
            return None
        items = data.get("data", []) if isinstance(data, dict) else data
        return items[0] if items else None

    async def list_products(self) -> list[dict]:
        """List all products with lifecycle data."""
        data = await self._get("/products")
        if isinstance(data, dict) and data.get("error"):
            return []
        return data.get("data", []) if isinstance(data, dict) else data
