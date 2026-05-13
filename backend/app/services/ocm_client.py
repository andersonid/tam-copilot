"""Async client for the Red Hat OCM (OpenShift Cluster Manager) API.

Fetches cluster telemetry, subscriptions, and organization data
for TAM accounts.
"""

import logging
from typing import Any

import httpx

from .redhat_auth import RedHatAuth

logger = logging.getLogger("tam_copilot.ocm")


class OcmClient:
    """Thin async wrapper over the OCM REST API."""

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
            logger.error("ocm GET %s -> %d", path, resp.status_code)
            return {"error": True, "status": resp.status_code, "detail": resp.text[:500]}
        return resp.json()

    # -- Organizations ---------------------------------------------------------

    async def find_org_by_ebs_account(self, ebs_account_id: str) -> dict | None:
        """Look up an OCM organization by EBS account number."""
        data = await self._get(
            "/api/accounts_mgmt/v1/organizations",
            params={"search": f"ebs_account_id='{ebs_account_id}'"},
        )
        items = data.get("items", []) if isinstance(data, dict) else []
        return items[0] if items else None

    # -- Subscriptions (cluster registrations with telemetry) ------------------

    async def list_subscriptions(
        self,
        org_id: str = "",
        search: str = "",
        size: int = 100,
    ) -> list[dict]:
        """Fetch subscriptions with telemetry metrics."""
        params: dict[str, Any] = {"size": size, "order": "last_telemetry_date desc"}
        if org_id:
            params["search"] = f"organization_id='{org_id}'"
        elif search:
            params["search"] = search
        data = await self._get("/api/accounts_mgmt/v1/subscriptions", params=params)
        return data.get("items", []) if isinstance(data, dict) else []

    # -- Clusters --------------------------------------------------------------

    async def list_clusters(self, search: str = "", size: int = 100) -> list[dict]:
        """Fetch clusters from the Clusters Management API."""
        params: dict[str, Any] = {"size": size, "order": "creation_timestamp desc"}
        if search:
            params["search"] = search
        data = await self._get("/api/clusters_mgmt/v1/clusters", params=params)
        return data.get("items", []) if isinstance(data, dict) else []

    async def get_cluster(self, cluster_id: str) -> dict:
        return await self._get(f"/api/clusters_mgmt/v1/clusters/{cluster_id}")
