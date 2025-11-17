import { useState, useCallback } from 'react';

interface ErrorState {
  isOpen: boolean;
  title?: string;
  message: string;
  details?: string;
}

export function useErrorDialog() {
  const [errorState, setErrorState] = useState<ErrorState>({
    isOpen: false,
    message: '',
  });

  const showError = useCallback((title: string, message: string, details?: string) => {
    setErrorState({
      isOpen: true,
      title,
      message,
      details,
    });
  }, []);

  const showErrorMessage = useCallback((message: string, details?: string) => {
    setErrorState({
      isOpen: true,
      title: '错误',
      message,
      details,
    });
  }, []);

  const showErrorWithTitle = useCallback((title: string, message: string, details?: string) => {
    setErrorState({
      isOpen: true,
      title,
      message,
      details,
    });
  }, []);

  const closeError = useCallback(() => {
    setErrorState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 便捷方法：从异常对象中提取错误信息
  const showErrorFromException = useCallback((exception: any, defaultMessage?: string) => {
    const title = '错误';
    let message = defaultMessage || '发生了未知错误';
    let details = '';

    if (typeof exception === 'string') {
      message = exception;
    } else if (exception?.message) {
      message = exception.message;
      details = exception?.stack || JSON.stringify(exception, null, 2);
    } else if (exception?.error) {
      message = exception.error;
      details = exception?.details || JSON.stringify(exception, null, 2);
    } else {
      details = JSON.stringify(exception, null, 2);
    }

    setErrorState({
      isOpen: true,
      title,
      message,
      details: details || undefined,
    });
  }, []);

  return {
    errorState,
    showError,
    showErrorMessage,
    showErrorWithTitle,
    showErrorFromException,
    closeError,
  };
}