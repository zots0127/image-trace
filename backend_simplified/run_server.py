"""Image Trace Simplified - 后端启动入口（用于桌面内置后端打包）。

说明：
- Electron 桌面端会启动本文件打包后的可执行文件（PyInstaller --onefile）
- 通过环境变量控制端口与数据目录

环境变量：
- IMAGE_TRACE_HOST: 默认 127.0.0.1
- IMAGE_TRACE_PORT: 默认 8000
- IMAGE_TRACE_DATA_DIR: 默认 <cwd>/data

派生环境变量（供后端读取）：
- STATIC_DIR / UPLOAD_DIR / EXTRACT_DIR / DATABASE_URL
"""

import os
from pathlib import Path


def main() -> None:
    host = os.getenv("IMAGE_TRACE_HOST", "127.0.0.1")
    port = int(os.getenv("IMAGE_TRACE_PORT", "8000"))

    data_dir = Path(os.getenv("IMAGE_TRACE_DATA_DIR", str(Path.cwd() / "data")))
    uploads_dir = data_dir / "uploads"
    extracted_dir = data_dir / "extracted"
    data_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    extracted_dir.mkdir(parents=True, exist_ok=True)

    # 让 backend_simplified/app/main.py 读取这些配置
    os.environ.setdefault("STATIC_DIR", str(data_dir))
    os.environ.setdefault("UPLOAD_DIR", str(uploads_dir))
    os.environ.setdefault("EXTRACT_DIR", str(extracted_dir))

    # sqlite:/// + 绝对路径（sqlite:////...）兼容 get_database_url 的解析
    db_path = data_dir / "database.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite:////{db_path}")

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        log_level=os.getenv("IMAGE_TRACE_LOG_LEVEL", "info"),
    )


if __name__ == "__main__":
    main()
