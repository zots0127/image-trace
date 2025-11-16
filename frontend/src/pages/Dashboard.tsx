import { useEffect, useState } from "react";
import { getProjects, deleteProject, type Project } from "@/lib/api";
import { copyErrorToClipboard, APIError } from "@/lib/errorHandler";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ProjectCard } from "@/components/ProjectCard";
import { SystemHealth } from "@/components/SystemHealth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FolderOpen, Copy, RefreshCw, LogOut } from "lucide-react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadProjects = async () => {
    setLoading(true);
    try {
      console.log("开始加载项目列表...");
      const data = await getProjects();
      console.log("项目列表加载成功:", data);
      setProjects(data);
    } catch (error) {
      console.error("加载项目列表失败:", error);
      const err = error as APIError;
      toast({
        title: "加载失败",
        description: err.message || "无法连接到后端服务",
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
    loadProjects();
  }, []);

  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      toast({
        title: "项目已删除",
        description: "项目及其所有数据已被删除",
      });
      loadProjects();
    } catch (error) {
      const err = error as APIError;
      toast({
        title: "删除失败",
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
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">图片溯源分析系统</h1>
              <p className="text-muted-foreground mt-1">
                {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjects}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                刷新
              </Button>
              <CreateProjectDialog onProjectCreated={loadProjects} />
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <SystemHealth autoRefresh refreshInterval={30000} />
        </div>
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">暂无项目</h2>
            <p className="text-muted-foreground mb-6">创建您的第一个项目开始分析图片</p>
            <CreateProjectDialog onProjectCreated={loadProjects} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
