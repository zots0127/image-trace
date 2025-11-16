#!/usr/bin/env python3
"""
测试文档上传和图片提取功能
"""

import requests
import json
from pathlib import Path
import uuid

# API基础URL
BASE_URL = "https://duptest.0.af"

def test_document_upload():
    """测试文档上传功能"""

    print("🧪 开始测试文档上传功能...")

    # 1. 创建一个新项目
    project_name = f"document_test_{uuid.uuid4().hex[:8]}"
    print(f"📁 创建项目: {project_name}")

    project_response = requests.post(
        f"{BASE_URL}/projects",
        json={"name": project_name, "description": "测试文档上传功能"}
    )

    if project_response.status_code != 200:
        print(f"❌ 创建项目失败: {project_response.status_code}")
        print(project_response.text)
        return

    project_data = project_response.json()
    project_id = project_data["id"]
    print(f"✅ 项目创建成功: {project_id}")

    # 2. 查找测试文档
    test_files = []

    # 寻找PDF文件
    pdf_files = list(Path("/Users/kanshan").rglob("*.pdf"))[:3]  # 最多找3个
    if pdf_files:
        test_files.extend(pdf_files)
        print(f"📄 找到 {len(pdf_files)} 个PDF文件")

    # 寻找DOCX文件
    docx_files = list(Path("/Users/kanshan").rglob("*.docx"))[:2]  # 最多找2个
    if docx_files:
        test_files.extend(docx_files)
        print(f"📝 找到 {len(docx_files)} 个DOCX文件")

    # 寻找PPTX文件
    pptx_files = list(Path("/Users/kanshan").rglob("*.pptx"))[:2]  # 最多找2个
    if pptx_files:
        test_files.extend(pptx_files)
        print(f"📊 找到 {len(pptx_files)} 个PPTX文件")

    if not test_files:
        print("⚠️  没有找到测试文档，创建一个测试PDF...")
        # 创建一个简单的测试PDF
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter

        test_pdf_path = "/tmp/test_document.pdf"
        c = canvas.Canvas(test_pdf_path, pagesize=letter)
        c.drawString(100, 750, "测试文档")
        c.drawString(100, 700, "这是一个用于测试图片提取功能的PDF文档")
        c.drawString(100, 650, "包含一些基本文本内容")
        c.save()

        test_files = [Path(test_pdf_path)]
        print("✅ 创建了测试PDF文件")

    # 3. 上传文档
    uploaded_documents = []

    for file_path in test_files:
        if not file_path.exists():
            continue

        print(f"📤 上传文档: {file_path.name}")

        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'application/octet-stream')}
            response = requests.post(
                f"{BASE_URL}/documents/upload",
                files=files,
                params={'project_id': project_id}
            )

        if response.status_code == 200:
            doc_data = response.json()
            print(f"✅ 文档上传成功: {doc_data['id']}")
            print(f"   文件名: {doc_data['filename']}")
            print(f"   处理状态: {doc_data['processing_status']}")
            uploaded_documents.append(doc_data)
        else:
            print(f"❌ 文档上传失败: {response.status_code}")
            print(f"   错误信息: {response.text}")

    # 4. 等待处理完成并检查结果
    import time
    print("\n⏳ 等待图片提取处理完成...")

    for doc in uploaded_documents:
        doc_id = doc['id']
        doc_name = doc['filename']

        # 轮询检查处理状态
        for i in range(30):  # 最多等待30秒
            response = requests.get(f"{BASE_URL}/documents/{doc_id}")
            if response.status_code == 200:
                doc_info = response.json()
                status = doc_info['processing_status']

                if status == 'completed':
                    print(f"✅ {doc_name} 处理完成!")
                    print(f"   提取图片数量: {doc_info['extracted_image_count']}")

                    # 获取提取的图片列表
                    img_response = requests.get(f"{BASE_URL}/documents/{doc_id}/extracted-images")
                    if img_response.status_code == 200:
                        img_data = img_response.json()
                        print(f"   实际图片数量: {len(img_data['images'])}")

                        for idx, img in enumerate(img_data['images'][:3]):  # 只显示前3个
                            print(f"   图片 {idx+1}: {img['filename']} ({img['file_size']} bytes)")

                    break
                elif status == 'failed':
                    print(f"❌ {doc_name} 处理失败")
                    if 'metadata' in doc_info and 'error' in doc_info['metadata']:
                        print(f"   错误: {doc_info['metadata']['error']}")
                    break
                else:
                    print(f"⏳ {doc_name} 仍在处理中... ({i+1}/30)")
                    time.sleep(1)
            else:
                print(f"❌ 获取文档状态失败: {response.status_code}")
                break
        else:
            print(f"⏰ {doc_name} 处理超时")

    # 5. 显示项目最终状态
    print(f"\n📊 项目 '{project_name}' 最终状态:")

    # 获取项目文档
    docs_response = requests.get(f"{BASE_URL}/documents/project/{project_id}")
    if docs_response.status_code == 200:
        docs_data = docs_response.json()
        print(f"   总文档数: {docs_data['total_documents']}")

        total_extracted = sum(doc['extracted_image_count'] or 0 for doc in docs_data['documents'])
        print(f"   总提取图片数: {total_extracted}")

    # 获取项目图片（包括直接上传和从文档提取的）
    images_response = requests.get(f"{BASE_URL}/projects/{project_id}/images")
    if images_response.status_code == 200:
        images_data = images_response.json()
        print(f"   总图片数: {len(images_data['images'])}")

    print(f"\n🎉 测试完成!")
    print(f"📋 查看项目详情: {BASE_URL}/projects/{project_id}")
    print(f"📚 查看API文档: {BASE_URL}/docs")

    return project_id

if __name__ == "__main__":
    try:
        project_id = test_document_upload()
        print(f"\n💾 测试项目ID: {project_id}")
    except Exception as e:
        print(f"❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()