from abc import ABC, abstractmethod
from typing import Any, Optional


class AuthAdapter(ABC):
    """认证抽象，便于替换 Supabase / 自有认证 / 空实现。"""

    @abstractmethod
    def verify_token(self, token: str) -> bool:
        ...

    @abstractmethod
    def get_user(self, token: str) -> Optional[Any]:
        ...

