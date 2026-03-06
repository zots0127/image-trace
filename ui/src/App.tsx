import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BackendGate } from "@/components/BackendGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import Demo from "./pages/Demo";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import DuplicateReport from "./pages/DuplicateReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useTranslation(); // ensure i18n initializes once

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BackendGate>
            <HashRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/demo" element={<Demo />} />

                {/* App Routes (no auth needed — local desktop app) */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/project/:projectId" element={<ProjectDetail />} />
                <Route path="/report/:projectId" element={<DuplicateReport />} />

                {/* Redirect root to dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </HashRouter>
          </BackendGate>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
