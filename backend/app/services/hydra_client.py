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

    async def _post(self, path: str, body: dict | None = None) -> Any:
        url = f"{self._base}{path}"
        headers = await self._headers()
        resp = await self._http.post(url, headers=headers, json=body or {})
        if resp.status_code >= 400:
            logger.error("hydra POST %s -> %d", path, resp.status_code)
            return {"error": True, "status": resp.status_code, "detail": resp.text[:500]}
        return resp.json()

    # -- Accounts (search / details) -------------------------------------------

    async def search_accounts_by_name(self, name: str, rows: int = 10) -> list[dict]:
        """Discover accounts by name using the SOLR case search index.

        The Hydra Case Management API (confirmed via official Swagger at
        developers.redhat.com/api-catalog/api/case-management) does NOT
        expose a free-text account search endpoint.  The only account
        endpoints are direct lookups by number.

        As a workaround we search the SOLR case index — which contains
        ``case_account_name`` and ``case_accountNumber`` fields — and
        extract unique accounts from the results.
        """
        data = await self._get(
            "/search/cases",
            params={"q": name, "rows": min(rows * 3, 50), "start": 0},
        )
        if isinstance(data, dict) and data.get("error"):
            return []

        docs = data.get("response", {}).get("docs", [])
        seen: dict[str, dict] = {}
        for doc in docs:
            acct = doc.get("case_accountNumber", "")
            acct_name = doc.get("case_account_name", "")
            if acct and acct not in seen and name.lower() in acct_name.lower():
                seen[acct] = {
                    "accountNumber": acct,
                    "name": acct_name,
                }
            if len(seen) >= rows:
                break
        return list(seen.values())

    async def get_account(self, account_number: str) -> dict:
        """Fetch full account details by account number."""
        return await self._get(f"/v1/accounts/{account_number}")

    # -- Cases -----------------------------------------------------------------

    async def list_cases(
        self,
        account_number: str,
        include_closed: bool = True,
        max_results: int = 500,
        sort_field: str = "lastModifiedDate",
        sort_order: str = "DESC",
    ) -> list[dict]:
        """Fetch support cases via POST /v1/cases/filter."""
        body: dict[str, Any] = {
            "accountNumber": account_number,
            "includeClosed": include_closed,
            "maxResults": max_results,
            "offset": 0,
            "sortField": sort_field,
            "sortOrder": sort_order,
        }
        data = await self._post("/v1/cases/filter", body)
        if isinstance(data, dict) and data.get("error"):
            return []
        if isinstance(data, dict):
            return data.get("cases", data.get("case", []))
        return data if isinstance(data, list) else []

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
        """Legacy path ``/v1/accounts/{number}/entitlements`` (not in public Support API).

        The Case Management OpenAPI catalog does not publish this route; callers
        typically receive HTTP 404 and an empty list. Prefer OCM subscription
        sync for OpenShift entitlements.
        """
        data = await self._get(f"/v1/accounts/{account_number}/entitlements")
        if isinstance(data, dict) and data.get("error"):
            return []
        return data if isinstance(data, list) else data.get("items", [])
