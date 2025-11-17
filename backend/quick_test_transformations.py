#!/usr/bin/env python3
"""
快速测试图像变换匹配
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_image_transformations import create_test_images, test_similarity
import tempfile

def create_simple_test_image(output_path: str):
    """创建一个简单的测试图像"""
    import cv2
    import numpy as np
    
    # 创建一个有特征的图像（包含文字、形状等）
    img = np.ones((400, 600, 3), dtype=np.uint8) * 255
    
    # 添加一些矩形
    cv2.rectangle(img, (50, 50), (200, 150), (0, 0, 255), -1)
    cv2.rectangle(img, (250, 100), (400, 200), (0, 255, 0), -1)
    cv2.rectangle(img, (450, 50), (550, 150), (255, 0, 0), -1)
    
    # 添加一些圆形
    cv2.circle(img, (300, 300), 50, (255, 0, 255), -1)
    cv2.circle(img, (150, 350), 40, (0, 255, 255), -1)
    
    # 添加一些线条
    cv2.line(img, (100, 250), (500, 250), (0, 0, 0), 3)
    cv2.line(img, (300, 100), (300, 400), (0, 0, 0), 3)
    
    cv2.imwrite(output_path, img)
    print(f"创建测试图像: {output_path}")
    return output_path

if __name__ == "__main__":
    # 创建临时目录
    temp_dir = tempfile.mkdtemp(prefix="image_test_")
    print(f"测试目录: {temp_dir}\n")
    
    # 创建基础测试图像
    base_image = os.path.join(temp_dir, "base.jpg")
    create_simple_test_image(base_image)
    
    # 生成变换图像
    print("\n生成变换图像...")
    test_images = create_test_images(base_image, temp_dir)
    
    if not test_images:
        print("错误：无法生成测试图像")
        sys.exit(1)
    
    print(f"\n成功生成 {len(test_images)} 个测试图像\n")
    
    # 提取路径和描述
    image_paths = [path for _, path in test_images]
    descriptions = [desc for desc, _ in test_images]
    
    # 运行测试
    test_similarity(image_paths, descriptions)
    
    print(f"\n测试图像保存在: {temp_dir}")
    print("可以检查这些图像来验证算法效果")

