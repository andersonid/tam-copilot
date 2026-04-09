from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import LLMProvider
from ..schemas import LLMProviderCreate, LLMProviderUpdate, LLMProviderRead
from ..crypto import encrypt_api_key, decrypt_api_key

router = APIRouter(tags=["providers"])


def _provider_to_read(p: LLMProvider) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "provider_type": p.provider_type,
        "base_url": p.base_url,
        "default_model": p.default_model,
        "is_default": p.is_default,
        "is_active": p.is_active,
        "created_at": p.created_at,
        "has_api_key": bool(p.api_key_encrypted),
    }


@router.get("/providers", response_model=list[LLMProviderRead])
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LLMProvider).order_by(LLMProvider.name))
    return [_provider_to_read(p) for p in result.scalars().all()]


@router.post("/providers", response_model=LLMProviderRead, status_code=201)
async def create_provider(data: LLMProviderCreate, db: AsyncSession = Depends(get_db)):
    provider = LLMProvider(
        name=data.name,
        provider_type=data.provider_type,
        base_url=data.base_url,
        api_key_encrypted=encrypt_api_key(data.api_key) if data.api_key else None,
        default_model=data.default_model,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return _provider_to_read(provider)


@router.get("/providers/{provider_id}", response_model=LLMProviderRead)
async def get_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")
    return _provider_to_read(provider)


@router.put("/providers/{provider_id}", response_model=LLMProviderRead)
async def update_provider(provider_id: int, data: LLMProviderUpdate, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")
    if data.name is not None:
        provider.name = data.name
    if data.provider_type is not None:
        provider.provider_type = data.provider_type
    if data.base_url is not None:
        provider.base_url = data.base_url
    if data.api_key is not None:
        provider.api_key_encrypted = encrypt_api_key(data.api_key) if data.api_key else None
    if data.default_model is not None:
        provider.default_model = data.default_model
    if data.is_active is not None:
        provider.is_active = data.is_active
    await db.commit()
    await db.refresh(provider)
    return _provider_to_read(provider)


@router.delete("/providers/{provider_id}", status_code=204)
async def delete_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")
    if provider.is_default:
        raise HTTPException(400, "Cannot delete the default provider")
    await db.delete(provider)
    await db.commit()


@router.post("/providers/{provider_id}/set-default", response_model=LLMProviderRead)
async def set_default_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")
    result = await db.execute(select(LLMProvider).where(LLMProvider.is_default == True))
    for p in result.scalars().all():
        p.is_default = False
    provider.is_default = True
    await db.commit()
    await db.refresh(provider)
    return _provider_to_read(provider)


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")
    try:
        from ..services.llm_base import get_llm_client
        api_key = decrypt_api_key(provider.api_key_encrypted) if provider.api_key_encrypted else None
        client = get_llm_client(provider.provider_type, provider.base_url, api_key)
        ok = await client.test_connection(provider.default_model)
        if ok:
            return {"status": "ok", "message": "Connection successful"}
        raise HTTPException(502, "Connection test failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Connection test failed: {str(e)}")


@router.get("/providers/{provider_id}/models")
async def list_provider_models(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")
    try:
        from ..services.llm_base import get_llm_client
        api_key = decrypt_api_key(provider.api_key_encrypted) if provider.api_key_encrypted else None
        client = get_llm_client(provider.provider_type, provider.base_url, api_key)
        models = await client.list_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(502, f"Failed to list models: {str(e)}")
