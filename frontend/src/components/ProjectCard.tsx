import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Calendar, Trash2, Image as ImageIcon, FileText, BarChart3 } from "lucide-react";
import { Project } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5 text-primary" />
              {project.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Calendar className="h-3 w-3" />
              创建于 {formatDate(project.created_at)}
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作无法撤销。这将永久删除项目及其所有图片和分析结果。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
          {project.description || "暂无描述"}
        </p>
        
        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
            <ImageIcon className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs font-semibold">{project.image_count || 0}</span>
            <span className="text-[10px] text-muted-foreground">图片</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
            <FileText className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs font-semibold">{project.document_count || 0}</span>
            <span className="text-[10px] text-muted-foreground">文档</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
            <BarChart3 className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs font-semibold">{project.analysis_count || 0}</span>
            <span className="text-[10px] text-muted-foreground">分析</span>
          </div>
        </div>
        
        <Button
          onClick={() => navigate(`/project/${project.id}`)}
          className="w-full"
          variant="secondary"
        >
          查看详情
        </Button>
      </CardContent>
    </Card>
  );
}
