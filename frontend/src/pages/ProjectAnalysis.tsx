import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProject,
  getAnalysisResults,
  getAnalysisResult,
  getProjectImages,
  type Project,
  type AnalysisResult,
  type Image,
} from "@/lib/api";
import { APIError } from "@/lib/errorHandler";
import { useGlobalError } from "@/contexts/ErrorContext";
import { SimilarityMatrix } from "@/components/SimilarityMatrix";
import { FeatureMatchingVisualization } from "@/components/FeatureMatchingVisualization";
import { ImageConnectionNetworkSimple } from "@/components/ImageConnectionNetworkSimple";
import { SimilarityControls, ViewMode } from "@/components/SimilarityControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, BarChart3, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function ProjectAnalysis() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showErrorFromException } = useGlobalError();

  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 新的可视化状态
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ row: number; col: number } | null>(null);

  const loadData = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [projectData, analysesData, imagesData] = await Promise.all([
        getProject(projectId),
        getAnalysisResults(projectId),
        getProjectImages(projectId),
      ]);
      setProject(projectData);
      // 只显示已完成或失败的分析结果
      const completedAnalyses = analysesData.filter(
        a => a.status === "completed" || a.status === "failed"
      );
      setAnalyses(completedAnalyses);
      setImages(imagesData);
      
      // 如果有分析结果，默认选中第一个
      if (completedAnalyses.length > 0 && !selectedAnalysis) {
        loadAnalysisDetail(completedAnalyses[0]);
      }
    } catch (error) {
      const err = error as APIError;
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

  const loadAnalysisDetail = async (analysis: AnalysisResult) => {
    setLoadingDetail(true);
    try {
      const analysisId = analysis.analysis_id || analysis.id;
      const fullResult = await getAnalysisResult(analysisId);
      setSelectedAnalysis(fullResult);
    } catch (error) {
      const err = error as APIError;
      toast({
        title: "加载分析详情失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const getAlgorithmLabel = (algo: string) => {
    const labels: Record<string, string> = {
      fast: "快速特征",
      accurate: "ORB局部",
      hybrid: "混合模式",
      fast_multi_feature: "快速特征",
      orb_local_feature: "ORB局部",
      hybrid_fast_orb: "混合模式",
    };
    return labels[algo] || algo;
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          已完成
        </Badge>
      );
    } else if (status === "failed") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          失败
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "未知";
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 可视化事件处理函数
  const handleImageSelect = (imageIndex: number) => {
    setSelectedImageIndex(imageIndex === selectedImageIndex ? null : imageIndex);
  };

  const handleMatrixCellClick = (rowIndex: number, colIndex: number, value: number) => {
    setSelectedMatrixCell({ row: rowIndex, col: colIndex });
    // 同时选中对应的图片索引
    if (rowIndex !== colIndex) {
      setSelectedImageIndex(rowIndex);
    }
  };

  const handleClearSelection = () => {
    setSelectedImageIndex(null);
    setSelectedMatrixCell(null);
  };

  // 获取相似度矩阵数据
  const getSimilarityMatrix = () => {
    if (!selectedAnalysis) return [];
    return selectedAnalysis.similarity_matrix || selectedAnalysis.results?.similarity_matrix || [];
  };

  // 计算总可能的连接数
  const getTotalConnections = () => {
    const matrix = getSimilarityMatrix();
    if (matrix.length === 0) return 0;
    const n = matrix.length;
    return (n * (n - 1)) / 2; // nC2, 排除对角线
  };

  // 获取图片URL数组
  const getImageUrls = () => {
    return actualImages.map(img => `${API_BASE_URL}${img.public_url}`);
  };

  // 获取图片文件名数组
  const getImageFilenames = () => {
    return actualImages.map(img => img.filename);
  };

  // Filter only actual image files (not documents)
  const actualImages = images.filter(image =>
    image.mime_type && image.mime_type.startsWith('image/')
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">项目未找到</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回项目列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project/${projectId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回项目详情
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{project.name} - 分析结果</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              共 {analyses.length} 个分析结果
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
            >
              刷新
            </Button>
          </div>
        </div>

        {analyses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">
                暂无分析结果
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                请先在项目详情页面启动分析
              </p>
              <Button onClick={() => navigate(`/project/${projectId}`)}>
                返回项目详情
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 分析历史列表 */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>分析历史</CardTitle>
                  <CardDescription>点击查看详细结果</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyses.map((analysis) => {
                      const analysisId = analysis.analysis_id || analysis.id;
                      const isSelected = selectedAnalysis?.analysis_id === analysisId || selectedAnalysis?.id === analysisId;
                      
                      return (
                        <Card
                          key={analysisId}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isSelected ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => loadAnalysisDetail(analysis)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {getAlgorithmLabel(analysis.algorithm || analysis.algorithm_type || "")}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDate(analysis.created_at)}
                                </p>
                              </div>
                              {getStatusBadge(analysis.status)}
                            </div>
                            {analysis.processing_time_seconds && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <Clock className="h-3 w-3" />
                                处理时间: {analysis.processing_time_seconds.toFixed(1)} 秒
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 分析详情 */}
            <div className="lg:col-span-2">
              {loadingDetail ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </CardContent>
                </Card>
              ) : selectedAnalysis ? (
                <div className="space-y-6">
                  {/* 分析基本信息 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>
                            {getAlgorithmLabel(selectedAnalysis.algorithm || selectedAnalysis.algorithm_type || "")} 分析详情
                          </CardTitle>
                          <CardDescription className="mt-1">
                            分析ID: {selectedAnalysis.analysis_id || selectedAnalysis.id}
                          </CardDescription>
                        </div>
                        {getStatusBadge(selectedAnalysis.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">创建时间</p>
                          <p className="text-sm font-medium mt-1">
                            {formatDate(selectedAnalysis.created_at)}
                          </p>
                        </div>
                        {selectedAnalysis.completed_at && (
                          <div>
                            <p className="text-xs text-muted-foreground">完成时间</p>
                            <p className="text-sm font-medium mt-1">
                              {formatDate(selectedAnalysis.completed_at)}
                            </p>
                          </div>
                        )}
                        {selectedAnalysis.processing_time_seconds && (
                          <div>
                            <p className="text-xs text-muted-foreground">处理时间</p>
                            <p className="text-sm font-medium mt-1">
                              {selectedAnalysis.processing_time_seconds.toFixed(1)} 秒
                            </p>
                          </div>
                        )}
                        {selectedAnalysis.confidence_score !== undefined && (
                          <div>
                            <p className="text-xs text-muted-foreground">置信度</p>
                            <p className="text-sm font-medium mt-1">
                              {(selectedAnalysis.confidence_score * 100).toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 分析结果 */}
                  {selectedAnalysis.status === "completed" ? (
                    <div className="space-y-6">
                      {getSimilarityMatrix().length > 0 && (
                        <>
                          {/* 相似度控制面板 */}
                          <SimilarityControls
                            threshold={similarityThreshold}
                            onThresholdChange={setSimilarityThreshold}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            connectionCount={(() => {
                              const matrix = getSimilarityMatrix();
                              return matrix.flat().filter((val, idx) => {
                                const row = Math.floor(idx / matrix.length);
                                const col = idx % matrix.length;
                                return row < col && val >= similarityThreshold;
                              }).length;
                            })()}
                            totalPossibleConnections={getTotalConnections()}
                            selectedImage={selectedImageIndex}
                            onClearSelection={handleClearSelection}
                          />

                          {/* 可视化内容 */}
                          {(viewMode === 'matrix' || viewMode === 'combined') && (
                            <SimilarityMatrix
                              matrix={getSimilarityMatrix()}
                              imageNames={getImageFilenames()}
                              imageUrls={getImageUrls()}
                              threshold={similarityThreshold}
                              showThumbnails={true}
                              onCellClick={handleMatrixCellClick}
                              onThresholdChange={setSimilarityThreshold}
                              selectedCell={selectedMatrixCell}
                              orbData={selectedAnalysis.results?.orb}
                              projectId={projectId}
                              analysisId={selectedAnalysis.analysis_id || selectedAnalysis.id}
                            />
                          )}

                          {(viewMode === 'network' || viewMode === 'combined') && (
                            <ImageConnectionNetworkSimple
                              matrix={getSimilarityMatrix()}
                              imageUrls={getImageUrls()}
                              imageFilenames={getImageFilenames()}
                              threshold={similarityThreshold}
                              onThresholdChange={setSimilarityThreshold}
                              onNodeSelect={handleImageSelect}
                              selectedNode={selectedImageIndex}
                              orbData={selectedAnalysis.results?.orb}
                            />
                          )}
                        </>
                      )}

                      {/* 特征点匹配可视化 */}
                      {(selectedAnalysis.algorithm === "orb_local_feature" ||
                        selectedAnalysis.algorithm === "hybrid_fast_orb" ||
                        selectedAnalysis.algorithm_type === "orb_local_feature" ||
                        selectedAnalysis.algorithm_type === "hybrid_fast_orb") &&
                       selectedAnalysis.results?.orb?.pairwise_regions &&
                       selectedAnalysis.results.orb.pairwise_regions.length > 0 && (
                        <FeatureMatchingVisualization
                          regions={selectedAnalysis.results.orb.pairwise_regions}
                          imageUrls={actualImages.map(img => `${API_BASE_URL}${img.public_url}`)}
                          imageFilenames={actualImages.map(img => img.filename)}
                        />
                      )}
                    </div>
                  ) : selectedAnalysis.status === "failed" ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-destructive">
                          <p className="font-medium mb-2">分析失败</p>
                          <p className="text-sm">
                            {selectedAnalysis.error_message || selectedAnalysis.error || "未知错误"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-muted-foreground">等待结果...</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">
                      请选择一个分析结果查看详情
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

