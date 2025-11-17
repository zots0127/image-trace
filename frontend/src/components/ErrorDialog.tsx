import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
}

export function ErrorDialog({ isOpen, onClose, title = "错误", message, details }: ErrorDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // 复制完整的错误信息，包括标题、消息和详细信息
    const textToCopy = [
      `标题: ${title}`,
      `消息: ${message}`,
      details ? `详细信息:\n${details}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-sm text-muted-foreground flex-1">{message}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-3 text-xs shrink-0"
                title="一键复制完整错误信息"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    复制
                  </>
                )}
              </Button>
            </div>
            {details && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">详细信息：</span>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {details}
                  </pre>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>关闭</AlertDialogCancel>
          <AlertDialogAction onClick={handleCopy} className="min-w-[140px]">
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                已复制到剪贴板
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                一键复制错误信息
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}