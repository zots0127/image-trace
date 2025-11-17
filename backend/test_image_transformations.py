#!/usr/bin/env python3
"""
图像变换测试脚本
测试图像匹配算法对裁剪、旋转、缩放等变换的鲁棒性
"""

import cv2
import numpy as np
from PIL import Image
import os
import tempfile
import shutil
from pathlib import Path

def create_test_images(base_image_path: str, output_dir: str):
    """从基础图像创建各种变换版本"""
    
    # 读取原始图像
    img = cv2.imread(base_image_path)
    if img is None:
        print(f"错误：无法读取图像 {base_image_path}")
        return []
    
    h, w = img.shape[:2]
    test_images = []
    
    # 1. 原始图像（复制一份）
    original_path = os.path.join(output_dir, "00_original.jpg")
    cv2.imwrite(original_path, img)
    test_images.append(("原始图像", original_path))
    
    # 2. 缩放：缩小到50%
    scaled_down = cv2.resize(img, (w//2, h//2), interpolation=cv2.INTER_LINEAR)
    scaled_down_path = os.path.join(output_dir, "01_scaled_50pct.jpg")
    cv2.imwrite(scaled_down_path, scaled_down)
    test_images.append(("缩放50%", scaled_down_path))
    
    # 3. 缩放：放大到150%
    scaled_up = cv2.resize(img, (int(w*1.5), int(h*1.5)), interpolation=cv2.INTER_LINEAR)
    scaled_up_path = os.path.join(output_dir, "02_scaled_150pct.jpg")
    cv2.imwrite(scaled_up_path, scaled_up)
    test_images.append(("缩放150%", scaled_up_path))
    
    # 4. 旋转：顺时针90度
    rotated_90 = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    rotated_90_path = os.path.join(output_dir, "03_rotated_90deg.jpg")
    cv2.imwrite(rotated_90_path, rotated_90)
    test_images.append(("旋转90度", rotated_90_path))
    
    # 5. 旋转：180度
    rotated_180 = cv2.rotate(img, cv2.ROTATE_180)
    rotated_180_path = os.path.join(output_dir, "04_rotated_180deg.jpg")
    cv2.imwrite(rotated_180_path, rotated_180)
    test_images.append(("旋转180度", rotated_180_path))
    
    # 6. 旋转：任意角度（15度）
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, 15, 1.0)
    rotated_15 = cv2.warpAffine(img, M, (w, h))
    rotated_15_path = os.path.join(output_dir, "05_rotated_15deg.jpg")
    cv2.imwrite(rotated_15_path, rotated_15)
    test_images.append(("旋转15度", rotated_15_path))
    
    # 7. 裁剪：中心裁剪（保留80%）
    crop_size = int(min(w, h) * 0.8)
    start_x = (w - crop_size) // 2
    start_y = (h - crop_size) // 2
    cropped = img[start_y:start_y+crop_size, start_x:start_x+crop_size]
    cropped_path = os.path.join(output_dir, "06_cropped_center.jpg")
    cv2.imwrite(cropped_path, cropped)
    test_images.append(("中心裁剪80%", cropped_path))
    
    # 8. 裁剪：左上角裁剪（保留60%）
    crop_size2 = int(min(w, h) * 0.6)
    cropped_tl = img[0:crop_size2, 0:crop_size2]
    cropped_tl_path = os.path.join(output_dir, "07_cropped_top_left.jpg")
    cv2.imwrite(cropped_tl_path, cropped_tl)
    test_images.append(("左上角裁剪60%", cropped_tl_path))
    
    # 9. 组合变换：缩放+旋转
    scaled = cv2.resize(img, (w//2, h//2))
    center_scaled = (scaled.shape[1] // 2, scaled.shape[0] // 2)
    M = cv2.getRotationMatrix2D(center_scaled, 30, 1.0)
    scaled_rotated = cv2.warpAffine(scaled, M, (scaled.shape[1], scaled.shape[0]))
    scaled_rotated_path = os.path.join(output_dir, "08_scaled_rotated.jpg")
    cv2.imwrite(scaled_rotated_path, scaled_rotated)
    test_images.append(("缩放50%+旋转30度", scaled_rotated_path))
    
    # 10. 组合变换：裁剪+旋转
    cropped_for_rotate = img[start_y:start_y+crop_size, start_x:start_x+crop_size]
    center_crop = (crop_size // 2, crop_size // 2)
    M = cv2.getRotationMatrix2D(center_crop, 45, 1.0)
    cropped_rotated = cv2.warpAffine(cropped_for_rotate, M, (crop_size, crop_size))
    cropped_rotated_path = os.path.join(output_dir, "09_cropped_rotated.jpg")
    cv2.imwrite(cropped_rotated_path, cropped_rotated)
    test_images.append(("裁剪80%+旋转45度", cropped_rotated_path))
    
    # 11. JPEG压缩（质量降低）
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    compressed_path = os.path.join(output_dir, "10_compressed.jpg")
    pil_img.save(compressed_path, "JPEG", quality=60, optimize=True)
    test_images.append(("JPEG压缩60%", compressed_path))
    
    # 12. 亮度调整
    brightened = cv2.convertScaleAbs(img, alpha=1.2, beta=30)
    brightened_path = os.path.join(output_dir, "11_brightened.jpg")
    cv2.imwrite(brightened_path, brightened)
    test_images.append(("亮度增加", brightened_path))
    
    return test_images


def test_similarity(image_paths: list, descriptions: list):
    """测试图像相似度"""
    from app.routers_analysis import _orb_pairwise_analysis
    
    print("\n" + "="*80)
    print("开始测试图像相似度匹配...")
    print("="*80)
    
    # 运行ORB分析
    sim_matrix, match_counts, regions = _orb_pairwise_analysis(image_paths)
    
    if not sim_matrix:
        print("错误：无法计算相似度矩阵")
        return
    
    n = len(image_paths)
    print(f"\n测试图像数量: {n}")
    print("\n相似度矩阵（与原始图像比较）:")
    print("-" * 80)
    
    # 显示与原始图像（索引0）的相似度
    print(f"{'图像':<30} {'相似度':<10} {'匹配点数':<10} {'状态'}")
    print("-" * 80)
    
    for i in range(n):
        similarity = sim_matrix[0][i] if i < len(sim_matrix[0]) else 0.0
        match_count = match_counts[0][i] if i < len(match_counts[0]) else 0
        desc = descriptions[i] if i < len(descriptions) else f"图像{i+1}"
        
        # 判断是否成功识别
        if i == 0:
            status = "✓ 原始图像"
        elif similarity >= 0.95:
            status = "✓✓ 完美匹配"
        elif similarity >= 0.85:
            status = "✓ 良好匹配"
        elif similarity >= 0.70:
            status = "⚠ 部分匹配"
        else:
            status = "✗ 匹配失败"
        
        print(f"{desc:<30} {similarity:<10.4f} {match_count:<10} {status}")
    
    # 显示完整的相似度矩阵
    print("\n" + "="*80)
    print("完整相似度矩阵:")
    print("="*80)
    print(f"{'':<15}", end="")
    for i in range(min(n, 10)):  # 只显示前10个
        print(f"Img{i+1:<8}", end="")
    print()
    
    for i in range(min(n, 10)):
        desc = descriptions[i][:12] if i < len(descriptions) else f"Img{i+1}"
        print(f"{desc:<15}", end="")
        for j in range(min(n, 10)):
            if i < len(sim_matrix) and j < len(sim_matrix[i]):
                print(f"{sim_matrix[i][j]:<8.3f}", end="")
            else:
                print(f"{'0.000':<8}", end="")
        print()
    
    # 统计结果
    print("\n" + "="*80)
    print("测试结果统计:")
    print("="*80)
    
    high_sim_count = sum(1 for i in range(1, n) if sim_matrix[0][i] >= 0.95)
    good_sim_count = sum(1 for i in range(1, n) if 0.85 <= sim_matrix[0][i] < 0.95)
    partial_sim_count = sum(1 for i in range(1, n) if 0.70 <= sim_matrix[0][i] < 0.85)
    low_sim_count = sum(1 for i in range(1, n) if sim_matrix[0][i] < 0.70)
    
    print(f"完美匹配 (≥0.95): {high_sim_count}/{n-1}")
    print(f"良好匹配 (0.85-0.95): {good_sim_count}/{n-1}")
    print(f"部分匹配 (0.70-0.85): {partial_sim_count}/{n-1}")
    print(f"匹配失败 (<0.70): {low_sim_count}/{n-1}")
    
    success_rate = (high_sim_count + good_sim_count) / (n - 1) * 100 if n > 1 else 0
    print(f"\n总体成功率 (≥0.85): {success_rate:.1f}%")
    
    return sim_matrix, match_counts, regions


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python test_image_transformations.py <原始图像路径>")
        print("示例: python test_image_transformations.py test_image.jpg")
        sys.exit(1)
    
    base_image = sys.argv[1]
    
    if not os.path.exists(base_image):
        print(f"错误：图像文件不存在: {base_image}")
        sys.exit(1)
    
    # 创建临时目录存放测试图像
    temp_dir = tempfile.mkdtemp(prefix="image_test_")
    print(f"创建测试图像目录: {temp_dir}")
    
    try:
        # 生成测试图像
        print("\n生成测试图像...")
        test_images = create_test_images(base_image, temp_dir)
        
        if not test_images:
            print("错误：无法生成测试图像")
            sys.exit(1)
        
        print(f"成功生成 {len(test_images)} 个测试图像")
        for desc, path in test_images:
            print(f"  - {desc}: {os.path.basename(path)}")
        
        # 提取路径和描述
        image_paths = [path for _, path in test_images]
        descriptions = [desc for desc, _ in test_images]
        
        # 运行测试
        test_similarity(image_paths, descriptions)
        
        print(f"\n测试图像保存在: {temp_dir}")
        print("可以手动检查这些图像，然后删除临时目录")
        
    except Exception as e:
        print(f"\n错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # 询问是否删除临时目录
        # response = input("\n是否删除临时目录? (y/n): ")
        # if response.lower() == 'y':
        #     shutil.rmtree(temp_dir)
        #     print("临时目录已删除")
        pass

