import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProject,
  getAnalysisResult,
  getProjectDocuments,
  type Project,
  type Image,
  type AnalysisResult,
  type Document,
} from "@/lib/api";
import { copyErrorToClipboard, APIError } from "@/lib/errorHandler";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import { DocumentUploadZone } from "@/components/DocumentUploadZone";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { SimilarityMatrix } from "@/components/SimilarityMatrix";
import { SystemHealth } from "@/components/SystemHealth";
import { useAnalysisPolling } from "@/hooks/useAnalysisPolling";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Image as ImageIcon, RefreshCw, Copy, FileText } from "lucide-react";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [completedAnalyses, setCompletedAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);

  const { result: pollingResult, isPolling } = useAnalysisPolling({
    analysisId: currentAnalysisId,
    onComplete: async (result) => {
      toast({
        title: "分析完成",
        description: "图片分析已成功完成",
      });
      
      // 获取完整的分析结果
      try {
        const fullResult = await getAnalysisResult(result.analysis_id);
        setCompletedAnalyses((prev) => [fullResult, ...prev]);
      } catch (error) {
        console.error("获取分析结果失败:", error);
        setCompletedAnalyses((prev) => [result, ...prev]);
      }
      
      setCurrentAnalysisId(null);
    },
    onError: (error) => {
      toast({
        title: "分析失败",
        description: error.message,
        variant: "destructive",
      });
      setCurrentAnalysisId(null);
    },
  });

  const loadProject = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [projectData, documentsData] = await Promise.all([
        getProject(projectId),
        getProjectDocuments(projectId),
      ]);
      setProject(projectData);
      setDocuments(documentsData);
    } catch (error) {
      const err = error as APIError;
      toast({
        title: "加载失败",
        description: err.message,
        variant: "destructive",
        action: (
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={async () => {
              const success = await copyErrorToClipboard(err);
              if (success) {
                toast({ title: "已复制错误详情" });
              }
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            复制
          </Button>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const handleImagesUploaded = (uploadedImages: Image[]) => {
    setImages((prev) => [...prev, ...uploadedImages]);
  };

  const handleDocumentUploaded = (document: Document) => {
    setDocuments((prev) => [document, ...prev]);
    // 重新加载项目以获取提取的图片
    loadProject();
  };

  const handleAnalysisStarted = (analysisId: string) => {
    setCurrentAnalysisId(analysisId);
  };

  const getAlgorithmLabel = (algo: string) => {
    const labels: Record<string, string> = {
      fast: "快速特征",
      orb: "ORB局部",
      hybrid: "混合模式",
    };
    return labels[algo] || algo;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "default",
      processing: "secondary",
      failed: "destructive",
    };
    const labels: Record<string, string> = {
      completed: "已完成",
      processing: "处理中",
      failed: "失败",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">项目未找到</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
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
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadProject}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        {/* System Health */}
        <SystemHealth autoRefresh={true} refreshInterval={30000} />

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>上传文件</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="images" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="images">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  直接上传图片
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="h-4 w-4 mr-2" />
                  上传文档提取图片
                </TabsTrigger>
              </TabsList>
              <TabsContent value="images" className="mt-4">
                <ImageUploadZone
                  projectId={projectId!}
                  onImagesUploaded={handleImagesUploaded}
                />
              </TabsContent>
              <TabsContent value="documents" className="mt-4">
                <DocumentUploadZone
                  projectId={projectId!}
                  onDocumentUploaded={handleDocumentUploaded}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Documents */}
        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>已上传文档</CardTitle>
                <Badge variant="secondary">{documents.length} 个</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                          {doc.extracted_images_count !== undefined && (
                            <> • 提取 {doc.extracted_images_count} 张图片</>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        doc.status === "completed"
                          ? "default"
                          : doc.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {doc.status === "completed"
                        ? "已完成"
                        : doc.status === "failed"
                        ? "失败"
                        : "处理中"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Uploaded Images */}
        {images.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>已上传图片</CardTitle>
                <Badge variant="secondary">{images.length} 张</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-lg border overflow-hidden hover:shadow-lg transition-all"
                  >
                    <img
                      src={image.public_url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white text-xs text-center px-2">
                        <p className="font-medium truncate">{image.filename}</p>
                        <p className="text-white/70">
                          {(image.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Analysis Status */}
        {isPolling && pollingResult && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>分析进度</CardTitle>
                {getStatusBadge(pollingResult.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    正在使用 {getAlgorithmLabel(pollingResult.algorithm)} 分析...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    分析ID: {pollingResult.analysis_id}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Analyses */}
        {completedAnalyses.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">分析结果</h2>
            {completedAnalyses.map((analysis) => (
              <Card key={analysis.analysis_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {getAlgorithmLabel(analysis.algorithm)} 分析
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        分析ID: {analysis.analysis_id}
                      </p>
                    </div>
                    {getStatusBadge(analysis.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {analysis.status === "completed" && analysis.similarity_matrix ? (
                    <SimilarityMatrix matrix={analysis.similarity_matrix} />
                  ) : analysis.status === "failed" ? (
                    <div className="text-destructive">
                      <p className="font-medium">分析失败</p>
                      {analysis.error && (
                        <p className="text-sm mt-1">{analysis.error}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">等待结果...</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Analysis Panel */}
        <AnalysisPanel
          projectId={projectId!}
          hasImages={images.length > 0}
          onAnalysisStarted={handleAnalysisStarted}
        />
      </div>
    </div>
  );
}
