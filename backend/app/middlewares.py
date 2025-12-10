import logging
import time
from typing import Callable
from uuid import uuid4

from fastapi import Request, Response

logger = logging.getLogger("uvicorn.access")


async def request_id_middleware(request: Request, call_next: Callable) -> Response:
    """
    为每个请求注入/透传 X-Request-ID，记录简易结构化日志，便于追踪。
    """
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    start = time.time()
    response: Response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 2)

    response.headers["X-Request-ID"] = request_id
    logger.info(
        f'request_id={request_id} method={request.method} path={request.url.path} '
        f'status={response.status_code} duration_ms={duration_ms}'
    )
    return response

