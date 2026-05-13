"""Red Hat SSO token management for Hydra and OCM APIs.

Exchanges a long-lived offline token for short-lived access tokens,
with automatic refresh when the token approaches expiry.
"""

import asyncio
import logging
import time

import httpx

logger = logging.getLogger("tam_copilot.redhat_auth")

SSO_TOKEN_URL = (
    "https://sso.redhat.com/auth/realms/redhat-external"
    "/protocol/openid-connect/token"
)
SSO_CLIENT_ID = "rhsm-api"
TOKEN_REFRESH_MARGIN = 60  # seconds before expiry to trigger refresh


class RedHatAuth:
    """Manages access token lifecycle using a Red Hat SSO offline token."""

    def __init__(self, offline_token: str, http: httpx.AsyncClient):
        self._offline_token = offline_token
        self._http = http
        self._access_token: str | None = None
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    @property
    def is_configured(self) -> bool:
        return bool(self._offline_token)

    async def get_token(self) -> str:
        """Return a valid access token, refreshing if needed."""
        if not self._offline_token:
            raise RuntimeError("HYDRA_OFFLINE_TOKEN not configured")
        async with self._lock:
            if self._access_token and time.time() < self._expires_at - TOKEN_REFRESH_MARGIN:
                return self._access_token
            return await self._refresh()

    async def _refresh(self) -> str:
        resp = await self._http.post(
            SSO_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "client_id": SSO_CLIENT_ID,
                "refresh_token": self._offline_token,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self._access_token = data["access_token"]

        try:
            import jwt
            claims = jwt.decode(self._access_token, options={"verify_signature": False})
            self._expires_at = claims.get("exp", time.time() + data.get("expires_in", 900))
        except Exception:
            self._expires_at = time.time() + data.get("expires_in", 900)

        logger.info("sso token refreshed | expires_in=%ds", int(self._expires_at - time.time()))
        return self._access_token
