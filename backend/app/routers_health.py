import os
import psutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from fastapi import APIRouter, HTTPException
from sqlmodel import select
from .db import get_session, get_database_size
from .models import Project, Image, AnalysisResult

router = APIRouter(prefix="/health", tags=["health"])


def get_system_stats() -> Dict[str, Any]:
    """获取系统资源使用情况"""
    try:
        # CPU使用率
        cpu_percent = psutil.cpu_percent(interval=1)

        # 内存使用情况
        memory = psutil.virtual_memory()
        memory_stats = {
            "total_gb": round(memory.total / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2),
            "percent": memory.percent
        }

        # 磁盘使用情况
        disk = psutil.disk_usage('/')
        disk_stats = {
            "total_gb": round(disk.total / (1024**3), 2),
            "free_gb": round(disk.free / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "percent": round((disk.used / disk.total) * 100, 2)
        }

        # 上传目录大小
        upload_dir = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
        upload_size = 0
        file_count = 0
        if upload_dir.exists():
            for file_path in upload_dir.rglob('*'):
                if file_path.is_file():
                    upload_size += file_path.stat().st_size
                    file_count += 1

        upload_stats = {
            "size_mb": round(upload_size / (1024**2), 2),
            "file_count": file_count
        }

        return {
            "cpu": {"percent": cpu_percent},
            "memory": memory_stats,
            "disk": disk_stats,
            "uploads": upload_stats,
            "status": "healthy" if cpu_percent < 90 and memory.percent < 90 else "warning"
        }
    except Exception as e:
        return {
            "cpu": {"percent": 0},
            "memory": {"percent": 0, "total_gb": 0, "available_gb": 0, "used_gb": 0},
            "disk": {"percent": 0, "total_gb": 0, "free_gb": 0, "used_gb": 0},
            "uploads": {"size_mb": 0, "file_count": 0},
            "status": "error",
            "error": str(e)
        }


def get_database_stats() -> Dict[str, Any]:
    """获取数据库统计信息"""
    try:
        with get_session() as session:
            # 项目统计
            projects_count = len(session.exec(select(Project)).all())

            # 图片统计
            images = session.exec(select(Image)).all()
            images_count = len(images)

            # 分析结果统计
            analysis_results = session.exec(select(AnalysisResult)).all()
            analysis_count = len(analysis_results)

            # 最近的活动
            recent_projects = session.exec(
                select(Project).order_by(Project.created_at.desc()).limit(5)
            ).all()

            recent_analyses = session.exec(
                select(AnalysisResult).order_by(AnalysisResult.created_at.desc()).limit(5)
            ).all()

            db_size = get_database_size(session)

            return {
                "projects": {
                    "total": projects_count,
                    "recent": [
                        {
                            "id": str(p.id),
                            "name": p.name,
                            "created_at": p.created_at.isoformat()
                        } for p in recent_projects
                    ]
                },
                "images": {
                    "total": images_count,
                    "total_size_mb": round(sum(img.file_size or 0 for img in images) / (1024**2), 2)
                },
                "analysis": {
                    "total": analysis_count,
                    "recent": [
                        {
                            "id": str(a.id),
                            "algorithm_type": a.algorithm_type,
                            "created_at": a.created_at.isoformat(),
                            "processing_time_seconds": a.processing_time_seconds
                        } for a in recent_analyses
                    ]
                },
                "database_size_mb": round(db_size / (1024**2), 2),
                "status": "healthy"
            }
    except Exception as e:
        return {
            "projects": {"total": 0, "recent": []},
            "images": {"total": 0, "total_size_mb": 0},
            "analysis": {"total": 0, "recent": []},
            "database_size_mb": 0,
            "status": "error",
            "error": str(e)
        }


def get_storage_stats() -> Dict[str, Any]:
    """获取MinIO存储统计信息"""
    try:
        from .minio_client import storage_service, UPLOADS_BUCKET, ANALYSIS_BUCKET, TEMP_BUCKET

        # 获取各个存储桶的信息
        uploads_info = storage_service.get_bucket_info(UPLOADS_BUCKET)
        analysis_info = storage_service.get_bucket_info(ANALYSIS_BUCKET)
        temp_info = storage_service.get_bucket_info(TEMP_BUCKET)

        # 总计
        total_files = uploads_info["file_count"] + analysis_info["file_count"] + temp_info["file_count"]
        total_size = uploads_info["total_size_mb"] + analysis_info["total_size_mb"] + temp_info["total_size_mb"]

        return {
            "buckets": {
                "uploads": uploads_info,
                "analysis": analysis_info,
                "temp": temp_info
            },
            "total": {
                "files": total_files,
                "size_mb": round(total_size, 2)
            },
            "status": "healthy"
        }
    except Exception as e:
        return {
            "buckets": {
                "uploads": {"bucket": "image-trace-uploads", "file_count": 0, "total_size_mb": 0},
                "analysis": {"bucket": "image-trace-analysis", "file_count": 0, "total_size_mb": 0},
                "temp": {"bucket": "image-trace-temp", "file_count": 0, "total_size_mb": 0}
            },
            "total": {"files": 0, "size_mb": 0},
            "status": "error",
            "error": str(e)
        }


def get_service_info() -> Dict[str, Any]:
    """获取服务基本信息"""
    return {
        "service": "Image Traceability Analysis API",
        "version": "1.0.0",
        "status": "running",
        "uptime_seconds": int(psutil.boot_time()),
        "current_time": datetime.now().isoformat(),
        "environment": os.getenv("ENVIRONMENT", "development"),
        "debug_mode": os.getenv("DEBUG", "false").lower() == "true"
    }


@router.get("/")
async def basic_health() -> Dict[str, str]:
    """基础健康检查 - 用于负载均衡器和服务发现"""
    return {
        "status": "ok",
        "service": "Image Traceability Analysis API",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/detailed")
async def detailed_health() -> Dict[str, Any]:
    """详细健康检查 - 包含系统资源、数据库和存储信息"""
    return {
        "service": get_service_info(),
        "system": get_system_stats(),
        "database": get_database_stats(),
        "storage": get_storage_stats(),
        "timestamp": datetime.now().isoformat()
    }


@router.get("/system")
async def system_health() -> Dict[str, Any]:
    """系统资源健康检查"""
    return get_system_stats()


@router.get("/database")
async def database_health() -> Dict[str, Any]:
    """数据库健康检查"""
    return get_database_stats()


@router.get("/stats")
async def service_stats() -> Dict[str, Any]:
    """服务统计信息"""
    system_stats = get_system_stats()
    db_stats = get_database_stats()
    storage_stats = get_storage_stats()

    return {
        "service_info": get_service_info(),
        "performance": {
            "cpu_usage_percent": system_stats.get("cpu", {}).get("percent", 0),
            "memory_usage_percent": system_stats.get("memory", {}).get("percent", 0),
            "disk_usage_percent": system_stats.get("disk", {}).get("percent", 0)
        },
        "usage": {
            "total_projects": db_stats.get("projects", {}).get("total", 0),
            "total_images": db_stats.get("images", {}).get("total", 0),
            "total_analyses": db_stats.get("analysis", {}).get("total", 0),
            "database_size_mb": db_stats.get("database_size_mb", 0)
        },
        "storage": {
            "total_files": storage_stats.get("total", {}).get("files", 0),
            "total_size_mb": storage_stats.get("total", {}).get("size_mb", 0),
            "uploads_files": storage_stats.get("buckets", {}).get("uploads", {}).get("file_count", 0),
            "analysis_files": storage_stats.get("buckets", {}).get("analysis", {}).get("file_count", 0),
            "temp_files": storage_stats.get("buckets", {}).get("temp", {}).get("file_count", 0)
        },
        "status": "healthy" if (
            system_stats.get("status") == "healthy" and
            db_stats.get("status") == "healthy" and
            storage_stats.get("status") == "healthy"
        ) else "degraded",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """就绪检查 - 用于Kubernetes等容器编排"""
    system_stats = get_system_stats()
    db_stats = get_database_stats()

    # 检查关键条件
    is_ready = (
        system_stats.get("status") == "healthy" and
        db_stats.get("status") == "healthy" and
        system_stats.get("memory", {}).get("percent", 100) < 95 and
        system_stats.get("cpu", {}).get("percent", 100) < 95
    )

    return {
        "ready": is_ready,
        "status": "ready" if is_ready else "not_ready",
        "checks": {
            "system_healthy": system_stats.get("status") == "healthy",
            "database_healthy": db_stats.get("status") == "healthy",
            "memory_ok": system_stats.get("memory", {}).get("percent", 100) < 95,
            "cpu_ok": system_stats.get("cpu", {}).get("percent", 100) < 95
        },
        "timestamp": datetime.now().isoformat()
    }


@router.get("/live")
async def liveness_check() -> Dict[str, str]:
    """存活检查 - 用于Kubernetes等容器编排"""
    return {
        "alive": True,
        "status": "alive",
        "timestamp": datetime.now().isoformat()
    }
