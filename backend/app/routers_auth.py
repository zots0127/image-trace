from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

from .db import get_session
from .models import User, UserCreate, UserRead
from .supabase_client import supabase_service
from sqlmodel import select

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class SignUpResponse(BaseModel):
    user: Dict[str, Any]
    session: Dict[str, Any]
    profile: UserRead


class SignInResponse(BaseModel):
    user: Dict[str, Any]
    session: Dict[str, Any]
    profile: UserRead


class UserResponse(BaseModel):
    user: UserRead


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """获取当前认证用户"""
    try:
        # 验证token
        if not supabase_service.verify_token(credentials.credentials):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 获取Supabase用户信息
        supabase_user = supabase_service.get_user(credentials.credentials)
        if not supabase_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 在本地数据库中查找用户
        with get_session() as session:
            user = session.exec(select(User).where(User.supabase_id == supabase_user.id)).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User profile not found in local database",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/signup", response_model=SignUpResponse)
def sign_up(request: SignUpRequest) -> SignUpResponse:
    """用户注册"""
    try:
        # 在Supabase中创建用户
        supabase_response = supabase_service.sign_up(request.email, request.password)

        if not supabase_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user in Supabase"
            )

        # 在本地数据库中创建用户记录
        with get_session() as session:
            user_create = UserCreate(
                supabase_id=supabase_response.user.id,
                email=request.email,
                display_name=request.display_name or request.email.split("@")[0]
            )

            db_user = User.from_orm(user_create)
            session.add(db_user)
            session.commit()
            session.refresh(db_user)

        user_read = UserRead.from_orm(db_user)

        return SignUpResponse(
            user=supabase_response.user.model_dump(),
            session=supabase_response.session.model_dump() if supabase_response.session else {},
            profile=user_read
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/signin", response_model=SignInResponse)
def sign_in(request: SignInRequest) -> SignInResponse:
    """用户登录"""
    try:
        # 使用Supabase登录
        supabase_response = supabase_service.sign_in(request.email, request.password)

        if not supabase_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # 从本地数据库获取用户信息
        with get_session() as session:
            db_user = session.exec(select(User).where(User.supabase_id == supabase_response.user.id)).first()

            if not db_user:
                # 如果本地没有用户记录，创建一个
                user_create = UserCreate(
                    supabase_id=supabase_response.user.id,
                    email=request.email,
                    display_name=supabase_response.user.email.split("@")[0]
                )

                db_user = User.from_orm(user_create)
                session.add(db_user)
                session.commit()
                session.refresh(db_user)

        user_read = UserRead.from_orm(db_user)

        return SignInResponse(
            user=supabase_response.user.model_dump(),
            session=supabase_response.session.model_dump(),
            profile=user_read
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/signout")
def sign_out(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """用户登出"""
    try:
        supabase_service.sign_out(credentials.credentials)
        return {"message": "Successfully signed out"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logout failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)) -> UserResponse:
    """获取当前用户信息"""
    return UserResponse(user=current_user)


@router.get("/verify")
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, bool]:
    """验证token是否有效"""
    is_valid = supabase_service.verify_token(credentials.credentials)
    return {"valid": is_valid}


class SyncUserRequest(BaseModel):
    access_token: str
    user_id: str
    email: str
    display_name: str = None


@router.post("/sync-user", response_model=UserResponse)
def sync_user_with_backend(request: SyncUserRequest):
    """
    同步Supabase用户到后端数据库
    前端通过Supabase直接登录后，调用此接口在本地创建用户记录
    """
    try:
        # 验证access_token是否有效
        if not supabase_service.verify_token(request.access_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token"
            )

        # 在本地数据库中创建或更新用户记录
        with get_session() as session:
            # 检查用户是否已存在
            existing_user = session.exec(select(User).where(User.supabase_id == request.user_id)).first()

            if existing_user:
                # 更新用户信息
                existing_user.email = request.email
                existing_user.display_name = request.display_name or request.email.split("@")[0]
                existing_user.updated_at = datetime.utcnow()
                session.add(existing_user)
                session.commit()
                session.refresh(existing_user)
                db_user = existing_user
            else:
                # 创建新用户
                user_create = UserCreate(
                    supabase_id=request.user_id,
                    email=request.email,
                    display_name=request.display_name or request.email.split("@")[0]
                )

                db_user = User.from_orm(user_create)
                session.add(db_user)
                session.commit()
                session.refresh(db_user)

        user_read = UserRead.from_orm(db_user)
        return UserResponse(user=user_read)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync user: {str(e)}"
        )