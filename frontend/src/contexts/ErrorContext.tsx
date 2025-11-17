import React, { createContext, useContext, ReactNode } from 'react';
import { useErrorDialog } from '@/hooks/useErrorDialog';
import { ErrorDialog } from '@/components/ErrorDialog';

interface ErrorContextType {
  showError: (title: string, message: string, details?: string) => void;
  showErrorMessage: (message: string, details?: string) => void;
  showErrorWithTitle: (title: string, message: string, details?: string) => void;
  showErrorFromException: (exception: any, defaultMessage?: string) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function useGlobalError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useGlobalError must be used within an ErrorProvider');
  }
  return context;
}

interface ErrorProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const {
    showError,
    showErrorMessage,
    showErrorWithTitle,
    showErrorFromException,
    errorState,
    closeError,
  } = useErrorDialog();

  return (
    <ErrorContext.Provider
      value={{
        showError,
        showErrorMessage,
        showErrorWithTitle,
        showErrorFromException,
      }}
    >
      {children}
      <ErrorDialog
        isOpen={errorState.isOpen}
        onClose={closeError}
        title={errorState.title}
        message={errorState.message}
        details={errorState.details}
      />
    </ErrorContext.Provider>
  );
}