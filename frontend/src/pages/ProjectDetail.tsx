import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProject,
  getAnalysisResults,
  getProjectDocuments,
  getProjectImages,
  type Project,
  type Image,
  type Document,
} from "@/lib/api";
import { APIError } from "@/lib/errorHandler";
import { useGlobalError } from "@/contexts/ErrorContext";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import { DocumentUploadZone } from "@/components/DocumentUploadZone";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { SystemHealth } from "@/components/SystemHealth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Image as ImageIcon, RefreshCw, FileText, BarChart3 } from "lucide-react";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showErrorFromException } = useGlobalError();

  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProject = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // 先加载项目和文档
      const [projectData, documentsData] = await Promise.all([
        getProject(projectId),
        getProjectDocuments(projectId),
      ]);
      setProject(projectData);
      setDocuments(documentsData);

      // 单独加载图片，避免因为图片加载失败影响其他数据
      try {
        const imagesData = await getProjectImages(projectId);
        setImages(imagesData);
      } catch (imageError) {
        console.warn("加载图片失败，但其他数据正常:", imageError);
        // 图片加载失败不影响页面显示，只是图片列表为空
        setImages([]);
      }

      // 加载分析结果数量（仅用于统计）
      try {
        const analysesData = await getAnalysisResults(projectId);
        // 只统计已完成或失败的分析结果
        const completedCount = analysesData.filter(
          a => a.status === "completed" || a.status === "failed"
        ).length;
        // 更新项目数据中的分析结果数量
        setProject((prev) => prev ? { ...prev, analysis_count: completedCount } : null);
      } catch (analysisError) {
        console.warn("加载分析结果数量失败，但其他数据正常:", analysisError);
      }
    } catch (error) {
      const err = error as APIError;

      // 使用新的错误对话框系统
      showErrorFromException(error, `加载失败: ${err.message}`);

      // 同时显示简短的 toast 通知
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
    loadProject();
  }, [projectId]);

  const handleImagesUploaded = (uploadedImages: Image[]) => {
    setImages((prev) => [...prev, ...uploadedImages]);
  };

  // Filter only actual image files (not documents)
  const actualImages = images.filter(image =>
    image.mime_type && image.mime_type.startsWith('image/')
  );

  // 计算来源数：文档数量 + 单独上传的图片数量（不包括从文档提取的图片）
  const directUploadImages = actualImages.filter(image => 
    !image.source || image.source !== 'document'
  );
  
  // 确保 documents 是数组，避免 NaN
  const documentsCount = Array.isArray(documents) ? documents.length : 0;
  const directUploadCount = directUploadImages.length;
  const sourceCount = documentsCount + directUploadCount;

  const handleDocumentUploaded = (document: Document) => {
    setDocuments((prev) => {
      // 确保 prev 是数组
      const prevArray = Array.isArray(prev) ? prev : [];
      return [document, ...prevArray];
    });
    // 重新加载项目以获取提取的图片
    loadProject();
  };

  const handleAnalysisStarted = () => {
    // 分析启动后，刷新项目数据以更新统计
    setTimeout(() => {
      loadProject();
    }, 2000);
  };

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
          <p className="text-muted-foreground mb-4">项目不存在或加载失败</p>
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

        {/* 项目统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/project/${projectId}/images`)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                图片数量
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{actualImages.length}</div>
              <p className="text-xs text-muted-foreground mt-1">点击查看所有图片</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                来源数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sourceCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {documentsCount} 个文档 + {directUploadCount} 个直接上传
              </p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/project/${projectId}/analysis`)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                分析结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{project.analysis_count || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">点击查看分析结果</p>
            </CardContent>
          </Card>
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
        {documentsCount > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>已上传文档</CardTitle>
                <Badge variant="secondary">{documentsCount} 个</Badge>
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

        {/* Analysis Panel */}
        <AnalysisPanel
          projectId={projectId!}
          hasImages={actualImages.length > 0}
          onAnalysisStarted={handleAnalysisStarted}
        />
      </div>
    </div>
  );
}
