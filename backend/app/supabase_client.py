from typing import Optional, Dict, Any
from supabase import create_client, Client
from fastapi import HTTPException, status

from .config import settings

class SupabaseService:
    """Supabase服务类，用于用户认证和数据管理"""

    def __init__(self):
        if settings.supabase_url and settings.supabase_key:
            self.client: Client = create_client(settings.supabase_url, settings.supabase_key)
        else:
            self.client = None

    def sign_up(self, email: str, password: str) -> Dict[str, Any]:
        """用户注册"""
        try:
            if not self.client:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication provider not configured"
                )
            response = self.client.auth.sign_up({
                "email": email,
                "password": password
            })
            return response
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration failed: {str(e)}"
            )

    def sign_in(self, email: str, password: str) -> Dict[str, Any]:
        """用户登录"""
        try:
            if not self.client:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication provider not configured"
                )
            response = self.client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            return response
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Login failed: {str(e)}"
            )

    def sign_out(self, access_token: str) -> None:
        """用户登出"""
        try:
            if not self.client:
                return
            self.client.auth.sign_out(access_token)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Logout failed: {str(e)}"
            )

    def get_user(self, access_token: str) -> Optional[Dict[str, Any]]:
        """获取当前用户信息"""
        try:
            if not self.client:
                return None
            self.client.auth.set_session(access_token, None)
            response = self.client.auth.get_user()
            return response.user if response.user else None
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to get user: {str(e)}"
            )

    def verify_token(self, access_token: str) -> bool:
        """验证访问令牌是否有效"""
        try:
            if not self.client:
                return False
            user = self.get_user(access_token)
            return user is not None
        except:
            return False

    def create_user_profile(self, user_id: str, email: str, display_name: str = None) -> Dict[str, Any]:
        """创建用户配置文件"""
        try:
            if not self.client:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication provider not configured"
                )
            profile_data = {
                "id": user_id,
                "email": email,
                "display_name": display_name or email.split("@")[0],
                "created_at": "now()"
            }

            response = self.client.table("user_profiles").insert(profile_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create user profile: {str(e)}"
            )

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户配置文件"""
        try:
            if not self.client:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication provider not configured"
                )
            response = self.client.table("user_profiles").select("*").eq("id", user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User profile not found: {str(e)}"
            )

# 创建全局Supabase服务实例
supabase_service = SupabaseService()
