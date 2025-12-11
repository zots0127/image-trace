import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getProject,
  getProjectImages,
  analyzeImages,
  getComparisonResults,
  visualizeMatch,
  getAnalysisRuns,
  getAnalysisRunDetail,
  type Project,
  type Image,
  type AnalysisResult,
  type HashType,
  type AnalysisRun,
} from "@/lib/api";
import { copyErrorToClipboard, APIError } from "@/lib/errorHandler";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import { DocumentUploadZone } from "@/components/DocumentUploadZone";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { SimilarityMatrix } from "@/components/SimilarityMatrix";
import { SimilarityGraph } from "@/components/SimilarityGraph";
import { SystemHealth } from "@/components/SystemHealth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Image as ImageIcon, RefreshCw, Copy, FileText } from "lucide-react";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [compareResult, setCompareResult] = useState<AnalysisResult | null>(null);
  const [prefetching, setPrefetching] = useState(false);
  const [matchImage, setMatchImage] = useState<string | null>(null);
  const [matchLoadingGroup, setMatchLoadingGroup] = useState<number | null>(null);
  const [lastAlgo, setLastAlgo] = useState<HashType>("phash");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [matchAlgo, setMatchAlgo] = useState<HashType>("orb");
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const locale = i18n.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";

  const loadProject = useCallback(async () => {
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
      toast({
        title: t("project.loadFailed"),
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
                toast({ title: t("project.copyDetail") });
              }
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            {t("common.copy")}
          </Button>
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, t, toast]);

  const prefetchResult = useCallback(async () => {
    if (!projectId) return;
    setPrefetching(true);
    try {
      const res = await getComparisonResults(projectId);
      setCompareResult(res);
    } catch {
      // 忽略拉取失败，保持静默
    } finally {
      setPrefetching(false);
    }
  }, [projectId]);

  const loadRuns = useCallback(async () => {
    if (!projectId) return;
    setLoadingRuns(true);
    try {
      const data = await getAnalysisRuns(projectId);
      setRuns(data);
    } catch {
      // 静默
    } finally {
      setLoadingRuns(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    prefetchResult();
    loadRuns();
  }, [loadProject, prefetchResult, loadRuns]);

  const handleImagesUploaded = (uploadedImages: Image[]) => {
    setImages((prev) => [...prev, ...uploadedImages]);
    setCompareResult(null);
  };

  const handleDocumentUploaded = () => {
    // 文档上传会产出图片，刷新即可
    loadProject();
  };

  const getAlgorithmLabel = (algo: HashType) => {
    const labels: Record<HashType, string> = {
      phash: "感知哈希",
      dhash: "差值哈希",
      ahash: "平均哈希",
      whash: "小波哈希",
      orb: "ORB 局部特征",
      brisk: "BRISK 特征",
      sift: "SIFT 关键点",
      surf: "SURF 关键点",
      hybrid: "Hybrid (哈希+ORB)",
    };
    return labels[algo] || algo;
  };

  const handleAnalyze = async (algo: HashType) => {
    if (!projectId) return;
    setAnalyzing(true);
    try {
      setLastAlgo(algo);
      const res = await analyzeImages(projectId, algo);
      setCompareResult(res);
      toast({ title: t("project.analyzeSuccess"), description: t("project.analyzeSuccessDesc", { total: res.total_images, groups: res.groups.length }) });
    } catch (error) {
      const err = error as APIError;
      toast({
        title: t("project.analyzeFailed"),
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
                toast({ title: t("project.copyDetail") });
              }
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            {t("common.copy")}
          </Button>
        ),
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const similarityMatrix = useMemo(() => {
    if (!compareResult) return null;
    // Flatten all images for matrix display
    const allImages: Image[] = [
      ...compareResult.groups.flatMap((g) => g.images),
      ...compareResult.unique_images,
    ];
    const n = allImages.length;
    if (n === 0) return null;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    // For each group, set similarity_score for pairs
    compareResult.groups.forEach((g) => {
      const indices = g.images.map((img) => allImages.findIndex((x) => x.id === img.id)).filter((i) => i >= 0);
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          matrix[indices[i]][indices[j]] = g.similarity_score;
          matrix[indices[j]][indices[i]] = g.similarity_score;
        }
      }
    });
    return { matrix, images: allImages };
  }, [compareResult]);

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
          <h2 className="text-2xl font-bold mb-4">{t("project.notFound")}</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("project.backHome")}
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
              {t("project.back")}
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
            {t("project.refresh")}
          </Button>
        </div>

        {/* System Health */}
        <SystemHealth autoRefresh={true} refreshInterval={30000} />
        {runs.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("project.history")}</CardTitle>
                {loadingRuns && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <CardDescription>{t("project.historyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {runs.map((r) => (
                  <div key={r.id} className="rounded border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t("project.runId", { id: r.id })}</span>
                      <Badge variant="secondary">{r.hash_type}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString(locale)}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-3">
                      <span>{t("project.groupsCount", { count: r.groups_count })}</span>
                      <span>{t("project.uniqueCount", { count: r.unique_count })}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1"
                      onClick={async () => {
                        try {
                          const { result } = await getAnalysisRunDetail(r.id);
                          if (result) {
                            setCompareResult(result);
                            setLastAlgo(r.hash_type);
                            toast({ title: t("project.runLoaded"), description: t("project.runId", { id: r.id }) });
                          } else {
                            toast({ title: t("project.runNoResult"), description: t("project.runId", { id: r.id }), variant: "destructive" });
                          }
                        } catch (error) {
                          const err = error as APIError;
                          toast({ title: t("project.loadFailed"), description: err.message, variant: "destructive" });
                        }
                      }}
                    >
                      {t("project.viewResult")}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("project.uploadSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="images" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="images">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {t("project.uploadImagesTab")}
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("project.uploadDocsTab")}
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

        {/* Uploaded Images */}
        {images.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("project.uploadedTitle")}</CardTitle>
                <Badge variant="secondary">{t("project.uploadedCount", { count: images.length })}</Badge>
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
                      src={image.public_url || "/placeholder.svg"}
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
                          {image.file_size ? `${(image.file_size / 1024).toFixed(1)} KB` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis */}
        <AnalysisPanel
          projectId={projectId!}
          hasImages={images.length > 1}
          onAnalyze={handleAnalyze}
          loading={analyzing || prefetching}
        />

        {(analyzing || prefetching) && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {analyzing ? t("project.analyzing") : t("project.prefetching")}
          </div>
        )}

        {/* Compare Result */}
        {compareResult && similarityMatrix && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t("project.compareTitle", { groups: compareResult.groups.length, unique: compareResult.unique_images.length })}
              </CardTitle>
              <CardDescription>{t("project.compareDesc", { total: compareResult.total_images })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground flex flex-wrap gap-4">
                <span>{t("project.statsTotal", { count: compareResult.total_images })}</span>
                <span>{t("project.statsGroups", { count: compareResult.groups.length })}</span>
                <span>{t("project.statsUnique", { count: compareResult.unique_images.length })}</span>
                <span>{t("project.statsAlgo", { algo: lastAlgo })}</span>
                <span className="flex items-center gap-2">
                  {t("project.statsMatchAlgo")}
                  <select
                    className="border rounded px-2 py-1 text-sm bg-background"
                    value={matchAlgo}
                    onChange={(e) => setMatchAlgo(e.target.value as HashType)}
                  >
                    <option value="orb">ORB</option>
                    <option value="brisk">BRISK</option>
                    <option value="sift">SIFT</option>
                  </select>
                </span>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? t("project.toggleAdvancedHide") : t("project.toggleAdvancedShow")}
                </Button>
              </div>
              {showAdvanced && (
                <>
                  <SimilarityMatrix matrix={similarityMatrix.matrix} images={similarityMatrix.images} />
                  <SimilarityGraph groups={compareResult.groups} />
                </>
              )}
              <div className="space-y-3">
                {compareResult.groups.map((g) => (
                  <div key={g.group_id} className="p-3 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t("project.groupLabel", { id: g.group_id })}</div>
                      <Badge variant="secondary">{t("project.avgSimilarity", { percent: Math.round(g.similarity_score * 100) })}</Badge>
                      {g.images.length >= 2 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={matchLoadingGroup === g.group_id}
                          onClick={async () => {
                            const [a, b] = g.images;
                            setMatchLoadingGroup(g.group_id);
                            try {
                              const { url } = await visualizeMatch(a.id, b.id, matchAlgo);
                              setMatchImage(url);
                            } catch (error) {
                              const err = error as APIError;
                              toast({
                                title: t("project.generateMatchFailed"),
                                description: err.message,
                                variant: "destructive",
                              });
                            } finally {
                              setMatchLoadingGroup(null);
                            }
                          }}
                        >
                          {matchLoadingGroup === g.group_id ? t("project.generating") : t("project.viewMatches")}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {g.images.map((img) => (
                        <div key={img.id} className="w-24 h-24 overflow-hidden rounded border">
                          <img
                            src={img.public_url || "/placeholder.svg"}
                            alt={img.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {compareResult.unique_images.length > 0 && (
                  <div className="p-3 rounded border">
                    <div className="text-sm font-medium mb-2">{t("project.ungrouped")}</div>
                    <div className="flex gap-2 flex-wrap">
                      {compareResult.unique_images.map((img) => (
                        <div key={img.id} className="w-24 h-24 overflow-hidden rounded border">
                          <img
                            src={img.public_url || "/placeholder.svg"}
                            alt={img.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {matchImage && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-lg shadow-lg max-w-5xl w-full overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="text-sm font-medium">{t("project.matchModal")}</div>
                <Button variant="ghost" size="sm" onClick={() => setMatchImage(null)}>
                  {t("project.close")}
                </Button>
              </div>
              <div className="p-4 max-h-[80vh] overflow-auto bg-black">
                <img src={matchImage} alt="matches" className="mx-auto max-h-[75vh]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
