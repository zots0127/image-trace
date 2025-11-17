#!/usr/bin/env python3
"""
调试分析结果脚本
用于分析为什么某些图像被误判为高相似度
"""

import sys
import json
import os
from pathlib import Path
from uuid import UUID

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from app.db import get_session
from app.models import Project, Image, AnalysisResult
from sqlmodel import select

def analyze_project(project_id: str):
    """分析指定项目的分析结果"""
    
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        print(f"错误：无效的项目ID格式: {project_id}")
        return
    
    with get_session() as session:
        # 获取项目信息
        project = session.get(Project, project_uuid)
        if not project:
            print(f"错误：项目不存在: {project_id}")
            return
        
        print(f"项目: {project.name}")
        print(f"项目ID: {project_id}")
        print("="*80)
        
        # 获取图像列表
        images = session.exec(
            select(Image).where(Image.project_id == project_uuid).order_by(Image.created_at)
        ).all()
        print(f"\n图像列表（共{len(images)}张）:")
        for idx, img in enumerate(images, 1):
            print(f"  图像{idx}: {img.filename} (ID: {img.id})")
        
        # 获取最新的分析结果
        analyses = session.exec(
            select(AnalysisResult)
            .where(AnalysisResult.project_id == project_uuid)
            .order_by(AnalysisResult.created_at.desc())
        ).all()
        
        if not analyses:
            print("\n错误：没有找到分析结果")
            return
        
        analysis = analyses[0]
        print(f"\n分析结果:")
        print(f"  算法类型: {analysis.algorithm_type}")
        print(f"  状态: {analysis.status}")
        print(f"  创建时间: {analysis.created_at}")
        
        if not analysis.results:
            print("\n错误：分析结果为空")
            return
        
        # 解析分析结果
        try:
            results = json.loads(analysis.results)
        except Exception as e:
            print(f"\n错误：无法解析分析结果: {e}")
            return
    
    # 获取相似度矩阵
    sim_matrix = results.get('similarity_matrix')
    orb_data = results.get('orb', {})
    orb_regions = orb_data.get('pairwise_regions', [])
    match_counts = orb_data.get('match_counts', [])
    
    if not sim_matrix:
        print("\n错误：没有找到相似度矩阵")
        return
    
    print(f"\n相似度矩阵大小: {len(sim_matrix)}x{len(sim_matrix[0]) if sim_matrix else 0}")
    
    # 分析图像1和图像10的相似度（索引0和9）
    if len(sim_matrix) > 9 and len(sim_matrix[0]) > 9:
        similarity_1_10 = sim_matrix[0][9]
        similarity_10_1 = sim_matrix[9][0]
        
        print(f"\n{'='*80}")
        print("图像1 和 图像10 的相似度分析:")
        print(f"{'='*80}")
        print(f"相似度: {similarity_1_10:.4f}")
        
        # 查找对应的匹配区域数据
        region_1_10 = None
        for region in orb_regions:
            if region.get('source_index') == 0 and region.get('target_index') == 9:
                region_1_10 = region
                break
        
        if region_1_10:
            print(f"\n匹配详情:")
            print(f"  匹配点数: {region_1_10.get('match_count', 0)}")
            print(f"  内点数: {region_1_10.get('inlier_count', 0)}")
            print(f"  相似度分数: {region_1_10.get('score', 0):.4f}")
            
            # 获取总特征点数
            total_src = region_1_10.get('total_source_features', 0)
            total_dst = region_1_10.get('total_target_features', 0)
            print(f"  源图像总特征点数: {total_src}")
            print(f"  目标图像总特征点数: {total_dst}")
            
            # 计算匹配比例
            if total_src > 0 or total_dst > 0:
                match_ratio = region_1_10.get('match_count', 0) / max(total_src, total_dst)
                print(f"  匹配比例: {match_ratio:.4f} ({match_ratio*100:.2f}%)")
            
            # 计算内点比例
            if region_1_10.get('match_count', 0) > 0:
                inlier_ratio = region_1_10.get('inlier_count', 0) / region_1_10.get('match_count', 1)
                print(f"  内点比例: {inlier_ratio:.4f} ({inlier_ratio*100:.2f}%)")
            
            # 获取匹配距离信息
            feature_matches = region_1_10.get('feature_matches', {})
            match_distances = feature_matches.get('match_distances', [])
            if match_distances:
                avg_distance = sum(match_distances) / len(match_distances)
                min_distance = min(match_distances)
                max_distance = max(match_distances)
                print(f"  平均匹配距离: {avg_distance:.2f}")
                print(f"  最小匹配距离: {min_distance:.2f}")
                print(f"  最大匹配距离: {max_distance:.2f}")
            
            # 判断是否是标准化图表
            match_count = region_1_10.get('match_count', 0)
            total_features = max(total_src, total_dst)
            match_ratio = match_count / total_features if total_features > 0 else 0
            is_chart = total_features > 200 and match_ratio < 0.15
            
            print(f"\n诊断:")
            if is_chart:
                print(f"  ⚠️  可能是标准化图表（总特征点>{total_features}，匹配比例<15%）")
            if match_ratio < 0.35:
                print(f"  ⚠️  匹配比例很低（{match_ratio*100:.1f}%），可能是误匹配")
            if match_count < 30:
                print(f"  ⚠️  匹配点数量很少（{match_count}个），可能是偶然匹配")
            if similarity_1_10 > 0.7 and match_ratio < 0.3:
                print(f"  ❌ 相似度{similarity_1_10:.2f}过高，但匹配比例只有{match_ratio*100:.1f}%，这是误匹配！")
        else:
            print("\n警告：没有找到图像1和图像10的匹配区域数据")
            if match_counts and len(match_counts) > 0 and len(match_counts[0]) > 9:
                print(f"匹配点数: {match_counts[0][9]}")
    
    # 显示完整的相似度矩阵（前10x10）
    print(f"\n{'='*80}")
    print("完整相似度矩阵（前10x10）:")
    print(f"{'='*80}")
    print(f"{'':<12}", end="")
    for j in range(min(10, len(sim_matrix[0]))):
        print(f"Img{j+1:<8}", end="")
    print()
    
    for i in range(min(10, len(sim_matrix))):
        img_name = images[i].filename[:10] if i < len(images) else f"Img{i+1}"
        print(f"{img_name:<12}", end="")
        for j in range(min(10, len(sim_matrix[i]))):
            sim = sim_matrix[i][j]
            # 标记高相似度但可能是误匹配的情况
            marker = ""
            if i != j and sim > 0.7:
                # 检查匹配比例
                if match_counts and i < len(match_counts) and j < len(match_counts[i]):
                    match_count = match_counts[i][j]
                    # 估算匹配比例（假设平均特征点数）
                    estimated_ratio = match_count / 500 if match_count > 0 else 0
                    if estimated_ratio < 0.3:
                        marker = "⚠"
            print(f"{sim:<7.3f}{marker}", end="")
        print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python debug_analysis.py <project_id>")
        print("示例: python debug_analysis.py 2e91f8d1-4db2-40ee-a8d2-d23a7dda657c")
        sys.exit(1)
    
    project_id = sys.argv[1]
    analyze_project(project_id)

