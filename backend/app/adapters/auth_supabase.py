from typing import Any, Optional

from .auth import AuthAdapter
from ..supabase_client import supabase_service


class SupabaseAuthAdapter(AuthAdapter):
    """基于 Supabase 的认证适配器，复用既有逻辑。"""

    def verify_token(self, token: str) -> bool:
        return supabase_service.verify_token(token)

    def get_user(self, token: str) -> Optional[Any]:
        return supabase_service.get_user(token)

