import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProject,
  getProjectImages,
  type Project,
  type Image,
} from "@/lib/api";
import { APIError } from "@/lib/errorHandler";
import { useGlobalError } from "@/contexts/ErrorContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Image as ImageIcon, FileText } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function ProjectImages() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showErrorFromException } = useGlobalError();

  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [projectData, imagesData] = await Promise.all([
        getProject(projectId),
        getProjectImages(projectId),
      ]);
      setProject(projectData);
      setImages(imagesData);
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

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Filter only actual image files (not documents)
  const actualImages = images.filter(image =>
    image.mime_type && image.mime_type.startsWith('image/')
  );

  // 按来源分组
  const directUploadImages = actualImages.filter(image => 
    !image.source || image.source !== 'document'
  );
  const documentImages = actualImages.filter(image => 
    image.source === 'document'
  );

  // 按文档分组
  const imagesByDocument = new Map<string, Image[]>();
  documentImages.forEach(image => {
    const docName = image.document_filename || '未知文档';
    if (!imagesByDocument.has(docName)) {
      imagesByDocument.set(docName, []);
    }
    imagesByDocument.get(docName)!.push(image);
  });

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
              <h1 className="text-3xl font-bold">{project.name} - 图片列表</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              共 {actualImages.length} 张图片
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

        {/* 统计信息 */}
        <Card>
          <CardHeader>
            <CardTitle>图片统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center p-4 rounded-md bg-muted/50">
                <ImageIcon className="h-5 w-5 text-primary mb-2" />
                <span className="text-2xl font-bold">{actualImages.length}</span>
                <span className="text-sm text-muted-foreground">总图片数</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-md bg-muted/50">
                <ImageIcon className="h-5 w-5 text-blue-500 mb-2" />
                <span className="text-2xl font-bold">{directUploadImages.length}</span>
                <span className="text-sm text-muted-foreground">直接上传</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-md bg-muted/50">
                <FileText className="h-5 w-5 text-green-500 mb-2" />
                <span className="text-2xl font-bold">{documentImages.length}</span>
                <span className="text-sm text-muted-foreground">文档提取</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 直接上传的图片 */}
        {directUploadImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>直接上传的图片</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                共 {directUploadImages.length} 张
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {directUploadImages.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-lg border overflow-hidden hover:shadow-lg transition-all"
                  >
                    <img
                      src={`${API_BASE_URL}${image.public_url}`}
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

        {/* 按文档分组的图片 */}
        {Array.from(imagesByDocument.entries()).map(([docName, docImages]) => (
          <Card key={docName}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-500" />
                    来自文档: {docName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    共提取 {docImages.length} 张图片
                  </p>
                </div>
                <Badge variant="secondary">{docImages.length} 张</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {docImages.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-lg border overflow-hidden hover:shadow-lg transition-all"
                  >
                    <img
                      src={`${API_BASE_URL}${image.public_url}`}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    {/* 文档名称标签 */}
                    <div className="absolute top-2 left-2 right-2 z-10">
                      <Badge
                        variant="secondary"
                        className="bg-green-600/90 text-white text-xs px-2 py-0.5 truncate w-full"
                        title={docName}
                      >
                        <FileText className="h-3 w-3 mr-1 inline" />
                        {docName}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white text-xs text-center px-2">
                        <p className="font-medium truncate">{image.filename}</p>
                        <p className="text-white/70">
                          {(image.file_size / 1024).toFixed(1)} KB
                        </p>
                        <p className="text-white/60 mt-1 text-[10px]">
                          来自: {docName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* 空状态 */}
        {actualImages.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">
                暂无图片
              </p>
              <p className="text-sm text-muted-foreground">
                请先上传图片或文档
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

