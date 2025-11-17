import React from 'react';
import { Button } from '@/components/ui/button';
import { useGlobalError } from '@/contexts/ErrorContext';

export function ErrorDialogExample() {
  const { showError, showErrorMessage, showErrorFromException } = useGlobalError();

  const handleBasicError = () => {
    showErrorMessage('这是一个基本的错误消息');
  };

  const handleDetailedError = () => {
    showError(
      '网络错误',
      '无法连接到服务器，请检查网络连接',
      '网络请求失败：GET /api/projects\n状态码：500\n时间戳：2025-11-16T17:50:00Z\n请求ID：req-123456'
    );
  };

  const handleExceptionError = () => {
    const error = new Error('示例异常');
    error.stack = 'Error: 示例异常\n    at ExampleComponent (/src/components/Example.tsx:15:20)\n    at callExample (/src/utils/utils.tsx:42:10)';
    showErrorFromException(error);
  };

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold mb-4">错误对话框示例</h3>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleBasicError}>
          基本错误
        </Button>
        <Button variant="outline" onClick={handleDetailedError}>
          详细错误
        </Button>
        <Button variant="outline" onClick={handleExceptionError}>
          异常错误
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        点击按钮测试不同类型的错误对话框，所有错误都支持一键复制功能。
      </p>
    </div>
  );
}