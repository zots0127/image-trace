from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


def _extract_request_id(request: Request) -> str:
    return request.headers.get("X-Request-ID", "unknown")


def add_exception_handlers(app: FastAPI) -> None:
    """
    统一异常响应格式，包含 request_id，便于前后端对齐和排障。
    """

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail,
                },
                "request_id": _extract_request_id(request),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": 422,
                    "message": "Validation error",
                    "details": exc.errors(),
                },
                "request_id": _extract_request_id(request),
            },
        )

    @app.middleware("http")
    async def catch_exceptions_middleware(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:  # pragma: no cover
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": 500,
                        "message": "Internal server error",
                    },
                    "request_id": _extract_request_id(request),
                },
            )

