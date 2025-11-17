import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePairFeatureMatching } from '@/components/ImagePairFeatureMatching';

// 模拟特征点数据 - 基于真实几何变换
const generateTransformation = (dx, dy, angle, scale, centerX, centerY) => {
  const rad = angle * Math.PI / 180;
  return (x, y) => {
    // 平移到原点
    let tx = x - centerX;
    let ty = y - centerY;

    // 缩放
    tx *= scale;
    ty *= scale;

    // 旋转
    const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
    const ry = tx * Math.sin(rad) + ty * Math.cos(rad);

    // 平移回原位并加上偏移
    return {
      x: rx + centerX + dx,
      y: ry + centerY + dy
    };
  };
};

// 创建仿射变换：平移+旋转+缩放
const transform = generateTransformation(50, 30, 15, 1.2, 200, 150);

const basePoints = [
  { x: 100, y: 100, response: 0.9 },
  { x: 300, y: 100, response: 0.8 },
  { x: 200, y: 200, response: 0.7 },
  { x: 150, y: 150, response: 0.6 },
  { x: 250, y: 150, response: 0.8 },
  { x: 180, y: 120, response: 0.5 },
  { x: 220, y: 180, response: 0.7 }
];

const mockMatches = basePoints.map((point, idx) => {
  const transformed = transform(point.x, point.y);
  const distance = 10 + idx * 8; // 模拟不同质量的匹配

  return {
    queryIdx: idx,
    trainIdx: idx,
    distance: distance,
    queryPoint: { ...point },
    trainPoint: {
      x: Math.round(transformed.x),
      y: Math.round(transformed.y),
      response: point.response * 0.9
    }
  };
});

// 从匹配点生成特征点数据
const mockKeypoints1 = basePoints;

const mockKeypoints2 = basePoints.map(point => {
  const transformed = transform(point.x, point.y);
  return {
    x: Math.round(transformed.x),
    y: Math.round(transformed.y),
    response: point.response * 0.9
  };
});

// 添加一些额外的特征点（未匹配的）
mockKeypoints1.push(
  { x: 120, y: 180, response: 0.4 },
  { x: 280, y: 160, response: 0.3 },
  { x: 160, y: 250, response: 0.5 }
);

mockKeypoints2.push(
  { x: 180, y: 200, response: 0.3 },
  { x: 320, y: 180, response: 0.2 },
  { x: 200, y: 270, response: 0.4 }
);

export default function FeatureMatchingTest() {
  const navigate = useNavigate();

  // 从URL参数获取图片索引
  const urlParams = new URLSearchParams(window.location.search);
  const image1Index = urlParams.get('image1') || '0';
  const image2Index = urlParams.get('image2') || '1';

  // 构造图片URL - 使用现有项目的图片
  const projectId = '061200e8-7e44-4f58-85c1-c8da5b18c2d6';
  const image1Url = `http://127.0.0.1:8000/projects/${projectId}/images/0bec6903-8933-4d66-809b-7c879f8aaab5/file`;
  const image2Url = `http://127.0.0.1:8000/projects/${projectId}/images/4f1a9c02-1f05-4812-818f-a553ad14e121/file`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← 返回
          </button>
          <h1 className="text-3xl font-bold">特征点匹配测试</h1>
          <p className="text-muted-foreground">
            测试图片间的特征点连接线显示功能
          </p>
        </div>

        <div className="text-sm text-muted-foreground mb-6 space-y-2">
          <div>
            <p className="font-medium mb-1">几何变换参数：</p>
            <p>• 平移: (+50, +30) 像素</p>
            <p>• 旋转: 15°</p>
            <p>• 缩放: 1.2倍</p>
            <p>• 旋转中心: (200, 150)</p>
          </div>
          <div>
            <p className="font-medium mb-1">数据统计：</p>
            <p>• 匹配点数: {mockMatches.length}</p>
            <p>• 特征点数: 图片1={mockKeypoints1.length}, 图片2={mockKeypoints2.length}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs font-medium text-blue-800">💡 连接线规律：</p>
            <p className="text-xs text-blue-700">• 有旋转时，连接线会相交于旋转中心附近</p>
            <p className="text-xs text-blue-700">• 只有平移时，所有连接线平行且等距</p>
          </div>
        </div>

        <ImagePairFeatureMatching
          image1Url={image1Url}
          image2Url={image2Url}
          image1Filename="04c6c4e14aa1b596dc5767951c043d23.jpg"
          image2Filename="aa4e5508494193c80d26097df2cfbc98.jpg"
          matches={mockMatches}
          keypoints1={mockKeypoints1}
          keypoints2={mockKeypoints2}
          similarity={0.677}
        />
      </div>
    </div>
  );
}