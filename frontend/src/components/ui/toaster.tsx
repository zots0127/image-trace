import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, ToastAction } from "@/components/ui/toast";
import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

interface ToastItemProps {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  variant?: "default" | "destructive";
  [key: string]: any;
}

function ToastItem({ id, title, description, action, variant, ...props }: ToastItemProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 解码 HTML 实体
    const decodeHtmlEntities = (text: string): string => {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    };
    
    // 提取文本内容（处理 React 节点）
    const getTextContent = (node: React.ReactNode): string => {
      if (typeof node === 'string') {
        // 解码 HTML 实体（如 &lt; 变成 <）
        return decodeHtmlEntities(node);
      }
      if (typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(getTextContent).join('');
      if (node && typeof node === 'object' && 'props' in node) {
        return getTextContent(node.props.children);
      }
      return '';
    };
    
    const titleText = title ? getTextContent(title) : '';
    const descText = description ? getTextContent(description) : '';
    
    const textToCopy = [
      titleText ? `标题: ${titleText}` : '',
      descText ? `消息: ${descText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    
    if (!textToCopy.trim()) {
      console.warn('No text to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const success = document.execCommand('copy');
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          console.error('Failed to copy text using execCommand');
        }
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <Toast variant={variant} {...props}>
      <div className="grid gap-1 flex-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action || (variant === "destructive" && (
        <ToastAction
          altText="复制错误信息"
          onClick={handleCopy}
          className="shrink-0"
          asChild={false}
        >
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" />
              复制
            </>
          )}
        </ToastAction>
      ))}
      <ToastClose />
    </Toast>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function (toast) {
        return <ToastItem key={toast.id} {...toast} />;
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
