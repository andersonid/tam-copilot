"""Async client for the Red Hat Hydra Support API.

Provides methods to fetch cases, contacts, and entitlements
for a given customer account number.
"""

import logging
from typing import Any

import httpx

from .redhat_auth import RedHatAuth

logger = logging.getLogger("tam_copilot.hydra")


class HydraClient:
    """Thin async wrapper over the Hydra REST API."""

    def __init__(self, base_url: str, auth: RedHatAuth, http: httpx.AsyncClient):
        self._base = base_url.rstrip("/")
        self._auth = auth
        self._http = http

    async def _headers(self) -> dict[str, str]:
        token = await self._auth.get_token()
        return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    async def _get(self, path: str, params: dict | None = None) -> Any:
        url = f"{self._base}{path}"
        headers = await self._headers()
        resp = await self._http.get(url, headers=headers, params=params)
        if resp.status_code >= 400:
            logger.error("hydra GET %s -> %d", path, resp.status_code)
            return {"error": True, "status": resp.status_code, "detail": resp.text[:500]}
        return resp.json()

    # -- Cases -----------------------------------------------------------------

    async def list_cases(
        self, account_number: str, status: str = "", count: int = 500,
    ) -> list[dict]:
        """Fetch support cases for an account."""
        params: dict[str, Any] = {"account_number": account_number, "count": count}
        if status:
            params["status"] = status
        data = await self._get("/v1/cases", params=params)
        if isinstance(data, dict) and data.get("error"):
            return []
        return data if isinstance(data, list) else data.get("items", data.get("case", []))

    async def get_case(self, case_number: str) -> dict:
        return await self._get(f"/v1/cases/{case_number}")

    # -- Contacts (Accounts) ---------------------------------------------------

    async def list_contacts(self, account_number: str) -> list[dict]:
        """Fetch contacts associated with an account."""
        data = await self._get(f"/v1/accounts/{account_number}/contacts")
        if isinstance(data, dict) and data.get("error"):
            return []
        return data if isinstance(data, list) else data.get("items", [])

    # -- Entitlements ----------------------------------------------------------

    async def list_entitlements(self, account_number: str) -> list[dict]:
        """Fetch entitlements for an account."""
        data = await self._get(f"/v1/accounts/{account_number}/entitlements")
        if isinstance(data, dict) and data.get("error"):
            return []
        return data if isinstance(data, list) else data.get("items", [])
