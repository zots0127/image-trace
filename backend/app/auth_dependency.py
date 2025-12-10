from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .adapters.auth_supabase import SupabaseAuthAdapter

# 可选鉴权：通过配置开关控制，便于本地/测试跳过
security = HTTPBearer(auto_error=False)
auth_adapter = SupabaseAuthAdapter()


async def require_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> None:
    """
    当 AUTH_REQUIRED 为 True 时强制校验 Bearer Token，否则跳过。
    不返回用户对象，仅做通行校验，避免在业务层散落鉴权判断。
    """
    if not settings.auth_required:
        return None

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    if not auth_adapter.verify_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 进一步确认用户存在
    user = auth_adapter.get_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return None

