import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import verify_password, hash_password, create_access_token, get_current_user
from ..database import get_db
from ..models import AdminUser

logger = logging.getLogger("tam_copilot.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=4)


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(AdminUser).where(AdminUser.username == data.username))
    if not user or not verify_password(data.password, user.password_hash):
        logger.warning("auth.login.failed | username=%s", data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(user.username)
    logger.info("auth.login.success | username=%s", user.username)
    return LoginResponse(access_token=token, username=user.username)


@router.post("/change-password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    logger.info("auth.password_changed | username=%s", current_user.username)
    return {"detail": "Password changed successfully"}


@router.get("/me")
async def get_me(current_user: AdminUser = Depends(get_current_user)):
    return {"username": current_user.username}
