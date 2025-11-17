import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  getProject,
  getAnalysisResult,
  getProjectImages,
  type Project,
  type AnalysisResult,
  type Image,
} from "@/lib/api";
import { APIError } from "@/lib/errorHandler";
import { useGlobalError } from "@/contexts/ErrorContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, RotateCcw, Download, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface FeaturePoint {
  x: number;
  y: number;
  size?: number;
  angle?: number;
  response?: number;
  octave?: number;
}

interface FeatureMatch {
  queryIdx: number;
  trainIdx: number;
  distance: number;
  queryPoint: FeaturePoint;
  trainPoint: FeaturePoint;
}

interface Region {
  image1_idx: number;
  image2_idx: number;
  similarity: number;
  match_count: number;
  inlier_count: number;
  matches: FeatureMatch[];
  keypoints1: FeaturePoint[];
  keypoints2: FeaturePoint[];
}

export default function ImagePairDetail() {
  const { projectId, analysisId } = useParams<{ projectId: string; analysisId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showErrorFromException } = useGlobalError();

  const image1Index = parseInt(searchParams.get("image1") || "0");
  const image2Index = parseInt(searchParams.get("image2") || "1");

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [showAllKeypoints, setShowAllKeypoints] = useState(false);
  const [maxDistance, setMaxDistance] = useState(100);

  const loadData = async () => {
    if (!projectId || !analysisId) {
      console.error("Missing projectId or analysisId:", { projectId, analysisId });
      return;
    }

    console.log("Loading image pair detail:", { projectId, analysisId, image1Index, image2Index });
    
    setLoading(true);
    try {
      const [projectData, analysisData, imagesData] = await Promise.all([
        getProject(projectId),
        getAnalysisResult(analysisId),
        getProjectImages(projectId),
      ]);
      
      console.log("Analysis data loaded:", analysisData);
      console.log("Pairwise regions:", analysisData.results?.pairwise_regions);
      console.log("ORB data:", analysisData.results?.orb);
      
      setProject(projectData);
      setAnalysis(analysisData);
      setImages(imagesData.filter(img => img.mime_type?.startsWith('image/')));
    } catch (error) {
      const err = error as APIError;
      console.error("Failed to load data:", error);
      showErrorFromException(error, `加载失败: ${err.message}`);
      toast({
        title: "加载失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, analysisId]);

  // 获取当前图片对的匹配数据
  const getRegionData = (): Region | null => {
    // 尝试从两个可能的路径获取数据
    const regions = analysis?.results?.orb?.pairwise_regions || analysis?.results?.pairwise_regions;
    
    if (!regions) {
      console.warn("No pairwise_regions found in analysis results");
      return null;
    }

    console.log("Searching for region:", { image1Index, image2Index, totalRegions: regions.length });
    
    const region = regions.find(
      (r: Region) =>
        (r.image1_idx === image1Index && r.image2_idx === image2Index) ||
        (r.image1_idx === image2Index && r.image2_idx === image1Index)
    );

    if (!region) {
      console.warn("Region not found for images:", { image1Index, image2Index });
      return null;
    }
    
    console.log("Found region:", region);

    // 如果索引顺序相反，调换数据
    if (region.image1_idx === image2Index) {
      return {
        ...region,
        image1_idx: image1Index,
        image2_idx: image2Index,
        matches: region.matches?.map((m: FeatureMatch) => ({
          ...m,
          queryPoint: m.trainPoint,
          trainPoint: m.queryPoint,
          queryIdx: m.trainIdx,
          trainIdx: m.queryIdx,
        })) || [],
        keypoints1: region.keypoints2 || [],
        keypoints2: region.keypoints1 || [],
      };
    }

    return region;
  };

  const region = getRegionData();
  const image1 = images[image1Index];
  const image2 = images[image2Index];

  const getImageUrl = (img: Image) => {
    return `${API_BASE_URL}${img.public_url}`;
  };

  const handleZoomIn = () => setScale(prev => Math.min(3, prev * 1.2));
  const handleZoomOut = () => setScale(prev => Math.max(0.5, prev / 1.2));
  const handleReset = () => setScale(1);

  const handleDownloadCanvas = () => {
    // 实现下载功能
    toast({
      title: "下载功能",
      description: "该功能即将推出",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project || !analysis || !image1 || !image2) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">数据未找到</h2>
          <Button onClick={() => navigate(`/project/${projectId}/analysis`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回分析页面
          </Button>
        </div>
      </div>
    );
  }

  const goodMatches = region?.matches?.filter((m: FeatureMatch) => m.distance <= maxDistance) || [];
  const matchQuality = region?.matches?.length ? (goodMatches.length / region.matches.length * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project/${projectId}/analysis`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回分析结果
            </Button>
            <div>
              <h1 className="text-3xl font-bold">图片对比详情</h1>
              <p className="text-muted-foreground mt-1">
                {project.name} - {image1.filename} vs {image2.filename}
              </p>
            </div>
          </div>
        </div>

        {/* 统计信息卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">相似度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {((region?.similarity || 0) * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">匹配点数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {region?.match_count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">内点数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {region?.inlier_count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">匹配质量</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {matchQuality.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 主要内容 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>特征点匹配可视化</CardTitle>
                <CardDescription>
                  显示两张图片之间的特征点匹配关系
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadCanvas}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 控制面板 */}
            <div className="flex flex-wrap gap-4 items-center p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-keypoints"
                  checked={showAllKeypoints}
                  onChange={(e) => setShowAllKeypoints(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="show-keypoints" className="text-sm font-medium">
                  显示所有特征点
                </label>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <label htmlFor="max-distance" className="text-sm font-medium whitespace-nowrap">
                  匹配阈值:
                </label>
                <input
                  type="range"
                  id="max-distance"
                  min="10"
                  max="200"
                  step="10"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(Number(e.target.value))}
                  className="flex-1 min-w-32"
                />
                <span className="text-sm text-muted-foreground w-12">
                  {maxDistance}
                </span>
              </div>

              <Badge variant="outline" className="ml-auto">
                显示 {goodMatches.length}/{region?.matches?.length || 0} 个匹配
              </Badge>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="sidebyside" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sidebyside">并排对比</TabsTrigger>
                <TabsTrigger value="overlay">叠加对比</TabsTrigger>
              </TabsList>

              {/* 并排对比视图 */}
              <TabsContent value="sidebyside" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 图片1 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{image1.filename}</CardTitle>
                      <CardDescription>
                        源图像 - {region?.keypoints1?.length || 0} 个特征点
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="relative border rounded-lg overflow-hidden bg-muted/10">
                        <img
                          src={getImageUrl(image1)}
                          alt={image1.filename}
                          className="w-full h-auto object-contain"
                          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* 图片2 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{image2.filename}</CardTitle>
                      <CardDescription>
                        目标图像 - {region?.keypoints2?.length || 0} 个特征点
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="relative border rounded-lg overflow-hidden bg-muted/10">
                        <img
                          src={getImageUrl(image2)}
                          alt={image2.filename}
                          className="w-full h-auto object-contain"
                          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 匹配统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      匹配统计信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">总特征点（源）</p>
                        <p className="text-lg font-bold mt-1">{region?.keypoints1?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">总特征点（目标）</p>
                        <p className="text-lg font-bold mt-1">{region?.keypoints2?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">匹配成功</p>
                        <p className="text-lg font-bold mt-1 text-green-600">{goodMatches.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">平均距离</p>
                        <p className="text-lg font-bold mt-1">
                          {goodMatches.length > 0
                            ? (goodMatches.reduce((sum: number, m: FeatureMatch) => sum + m.distance, 0) / goodMatches.length).toFixed(1)
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 叠加对比视图 */}
              <TabsContent value="overlay">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground py-12">
                      <p className="mb-2">叠加对比视图</p>
                      <p className="text-sm">该功能即将推出</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* 图例 */}
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground py-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full border border-blue-700"></div>
                <span>源图特征点</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full border border-green-700"></div>
                <span>目标特征点</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full border border-amber-600"></div>
                <span>匹配点</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-green-500"></div>
                <span>高质量匹配</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500"></div>
                <span>低质量匹配</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

