#!/usr/bin/env python3
"""
完整的图片溯源分析系统测试脚本
测试所有API端点的功能
"""

import requests
import json
import time
import os
import base64
from io import BytesIO
from PIL import Image
import numpy as np

# API基础URL
BASE_URL = "https://duptest.0.af"

def print_test_header(test_name):
    """打印测试标题"""
    print(f"\n{'='*50}")
    print(f"测试: {test_name}")
    print(f"{'='*50}")

def print_result(test_name, success, details=""):
    """打印测试结果"""
    status = "✅ 成功" if success else "❌ 失败"
    print(f"{test_name}: {status}")
    if details:
        print(f"  详情: {details}")

def test_health_check():
    """测试健康检查端点"""
    print_test_header("健康检查")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        success = response.status_code == 200
        data = response.json() if success else None
        print_result("健康检查", success, data if success else f"状态码: {response.status_code}")
        return success
    except Exception as e:
        print_result("健康检查", False, str(e))
        return False

def create_test_image():
    """创建一个测试图片"""
    # 创建一个简单的测试图片
    img = Image.new('RGB', (300, 200), color='red')

    # 添加一些文字使图片更有趣
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)
    try:
        # 尝试使用系统字体
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
    except:
        # 如果找不到字体，使用默认字体
        font = ImageFont.load_default()

    draw.text((50, 50), "Test Image", fill='white', font=font)

    # 转换为字节流
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=90)
    return buffer.getvalue()

def test_project_management():
    """测试项目管理功能"""
    print_test_header("项目管理")

    # 创建项目
    try:
        project_data = {
            "name": f"测试项目_{int(time.time())}",
            "description": "这是一个自动化测试项目"
        }

        response = requests.post(
            f"{BASE_URL}/projects/",
            json=project_data,
            timeout=10
        )

        if response.status_code == 200:
            project = response.json()
            project_id = project.get('id')
            print_result("创建项目", True, f"项目ID: {project_id}")

            # 等待一秒确保数据保存
            time.sleep(1)

            # 获取项目列表
            response = requests.get(f"{BASE_URL}/projects/", timeout=10)
            if response.status_code == 200:
                projects = response.json()
                print_result("获取项目列表", True, f"找到 {len(projects)} 个项目")
            else:
                print_result("获取项目列表", False, f"状态码: {response.status_code}")
                return None

            # 获取特定项目详情
            response = requests.get(f"{BASE_URL}/projects/{project_id}", timeout=10)
            if response.status_code == 200:
                project_detail = response.json()
                print_result("获取项目详情", True, f"项目名: {project_detail.get('name')}")
            else:
                print_result("获取项目详情", False, f"状态码: {response.status_code}")

            return project_id
        else:
            print_result("创建项目", False, f"状态码: {response.status_code}")
            return None

    except Exception as e:
        print_result("项目管理", False, str(e))
        return None

def test_image_upload(project_id):
    """测试图片上传功能"""
    print_test_header("图片上传")

    if not project_id:
        print_result("图片上传", False, "没有有效的项目ID")
        return None

    try:
        # 创建测试图片
        image_data = create_test_image()

        # 上传图片
        files = {'files': ('test_image.jpg', image_data, 'image/jpeg')}
        params = {'project_id': project_id}

        response = requests.post(
            f"{BASE_URL}/upload/batch",
            files=files,
            params=params,
            timeout=30
        )

        if response.status_code == 200:
            upload_result = response.json()
            files = upload_result.get('files', [])
            if files:
                image_id = files[0].get('id')  # 获取第一个图片的ID
                print_result("图片上传", True, f"图片ID: {image_id}")
            else:
                print_result("图片上传", False, "返回的文件列表为空")
                return None

            # 验证图片已保存
            response = requests.get(f"{BASE_URL}/projects/{project_id}", timeout=10)
            if response.status_code == 200:
                project_detail = response.json()
                image_count = len(project_detail.get('images', []))
                print_result("图片验证", True, f"项目中有 {image_count} 张图片")

            return image_id
        else:
            error_msg = response.text
            print_result("图片上传", False, f"状态码: {response.status_code}, 错误: {error_msg}")
            return None

    except Exception as e:
        print_result("图片上传", False, str(e))
        return None

def test_image_analysis(project_id, image_id):
    """测试图片分析功能"""
    print_test_header("图片分析")

    if not project_id or not image_id:
        print_result("图片分析", False, "没有有效的项目ID或图片ID")
        return

    try:
        # 开始分析
        # 使用查询参数来启动分析
        params = {
            "mode": "fast",  # 使用快速模式
            "project_id": project_id
        }

        print("开始分析...")
        response = requests.post(
            f"{BASE_URL}/analysis/start",
            params=params,
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            analysis_id = result.get('id')  # 实际API返回的是id字段
            print_result("开始分析", True, f"分析ID: {analysis_id}")

            # 轮询分析结果
            print("等待分析完成...")
            max_attempts = 10
            for attempt in range(max_attempts):
                response = requests.get(
                    f"{BASE_URL}/analysis/results/{analysis_id}",
                    timeout=10
                )

                if response.status_code == 200:
                    analysis_result = response.json()
                    # 分析API是同步的，所以直接完成
                    print_result("分析完成", True, "分析已完成")

                    # 显示分析结果摘要
                    results = analysis_result.get('results', {})
                    similarity_matrix = results.get('similarity_matrix', [])
                    if similarity_matrix:
                        print(f"  相似度矩阵: {len(similarity_matrix)}x{len(similarity_matrix)}")

                    fast_results = results.get('fast', {})
                    if fast_results:
                        print("  快速特征分析: ✅ 已完成")

                    orb_results = results.get('orb', {})
                    if orb_results:
                        print("  ORB特征分析: ✅ 已完成")

                    break
                else:
                    print(f"获取分析结果失败: {response.status_code}")
                    break

        else:
            error_msg = response.text
            print_result("开始分析", False, f"状态码: {response.status_code}, 错误: {error_msg}")

    except Exception as e:
        print_result("图片分析", False, str(e))

def test_api_docs():
    """测试API文档可访问性"""
    print_test_header("API文档")
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=10)
        success = response.status_code == 200
        print_result("API文档访问", success, "Swagger UI可访问" if success else f"状态码: {response.status_code}")
    except Exception as e:
        print_result("API文档访问", False, str(e))

def main():
    """主测试函数"""
    print("🚀 开始完整系统测试")
    print(f"目标URL: {BASE_URL}")

    success_count = 0
    total_tests = 0

    # 1. 健康检查
    total_tests += 1
    if test_health_check():
        success_count += 1

    # 2. API文档
    total_tests += 1
    test_api_docs()  # 这个不算入主要测试

    # 3. 项目管理
    total_tests += 1
    project_id = test_project_management()
    if project_id:
        success_count += 1

        # 4. 图片上传
        total_tests += 1
        image_id = test_image_upload(project_id)
        if image_id:
            success_count += 1

            # 5. 图片分析
            total_tests += 1
            test_image_analysis(project_id, image_id)
            # 分析结果检查在test_image_analysis函数内部完成

    # 测试总结
    print(f"\n{'='*60}")
    print("🎯 测试总结")
    print(f"{'='*60}")
    print(f"总测试数: {total_tests}")
    print(f"成功测试: {success_count}")
    print(f"失败测试: {total_tests - success_count}")

    if success_count == total_tests:
        print("🎉 所有核心功能测试通过！")
    elif success_count > 0:
        print("⚠️ 部分功能测试通过")
    else:
        print("❌ 所有功能测试失败")

    print(f"\n可以通过浏览器访问 {BASE_URL}/docs 查看完整API文档")

if __name__ == "__main__":
    main()