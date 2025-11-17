import { useCallback } from "react";
import * as React from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadDocument, getDocument, type Document } from "@/lib/api";
import { copyErrorToClipboard, APIError } from "@/lib/errorHandler";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadZoneProps {
  projectId: string;
  onDocumentUploaded: (document: Document) => void;
}

export function DocumentUploadZone({ projectId, onDocumentUploaded }: DocumentUploadZoneProps) {
  const [uploading, setUploading] = React.useState(false);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const { toast } = useToast();

  const pollDocumentStatus = async (documentId: string) => {
    const maxAttempts = 120; // 最多轮询10分钟（120次 * 5秒）
    let attempts = 0;

    const poll = async (): Promise<void> => {
      try {
        attempts++;
        console.log(`[文档轮询] 第 ${attempts} 次检查文档 ${documentId} 的状态`);
        
        const doc = await getDocument(documentId);
        
        // 后端返回的是 processing_status 字段
        const status = doc.processing_status || doc.status;
        console.log(`[文档轮询] 文档状态: ${status}`);
        
        if (status === "completed") {
          setProcessing(null);
          toast({
            title: "文档处理完成",
            description: `已从文档中提取 ${doc.extracted_images_count || 0} 张图片`,
          });
          onDocumentUploaded(doc);
          return;
        } else if (status === "failed") {
          setProcessing(null);
          const errorMsg = doc.metadata?.error || doc.error || "未知错误";
          toast({
            title: "文档处理失败",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        } else if (attempts < maxAttempts) {
          // 继续轮询
          setTimeout(() => poll(), 5000); // 每5秒轮询一次
        } else {
          setProcessing(null);
          toast({
            title: "处理超时",
            description: `文档处理时间过长（已等待 ${Math.floor(attempts * 5 / 60)} 分钟），请刷新页面查看最新状态`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error(`[文档轮询] 获取状态失败 (第 ${attempts} 次):`, error);
        
        // 如果错误次数太多，停止轮询
        if (attempts >= maxAttempts) {
          setProcessing(null);
          const err = error as APIError;
          toast({
            title: "获取状态失败",
            description: `轮询 ${attempts} 次后仍无法获取文档状态: ${err.message}`,
            variant: "destructive",
          });
        } else {
          // 网络错误时，继续重试
          setTimeout(() => poll(), 5000);
        }
      }
    };

    await poll();
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);
      
      try {
        const document = await uploadDocument(projectId, file);
        toast({
          title: "文档上传成功",
          description: `${file.name} 正在处理中...`,
        });
        
        setProcessing(document.id);
        setUploading(false);
        
        // 开始轮询文档状态
        await pollDocumentStatus(document.id);
      } catch (error) {
        const err = error as APIError;
        toast({
          title: "上传失败",
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
        setUploading(false);
        setProcessing(null);
      }
    },
    [projectId, onDocumentUploaded, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    },
    maxFiles: 1,
    disabled: uploading || !!processing,
  });

  const isDisabled = uploading || !!processing;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
        isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50",
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <>
            <Upload className="h-12 w-12 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">上传中...</p>
          </>
        ) : processing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">处理中，正在提取图片...</p>
            <p className="text-xs text-muted-foreground">这可能需要几分钟时间</p>
          </>
        ) : (
          <>
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive ? "放开以上传文档" : "拖拽文档到此处或点击上传"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                支持 PDF、DOCX、PPTX 格式，系统将自动提取图片
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
