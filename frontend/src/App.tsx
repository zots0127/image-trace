import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectImages from "./pages/ProjectImages";
import ProjectAnalysis from "./pages/ProjectAnalysis";
import ImagePairDetail from "./pages/ImagePairDetail";
import FeatureMatchingTest from "./pages/FeatureMatchingTest";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId/images"
              element={
                <ProtectedRoute>
                  <ProjectImages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId/analysis"
              element={
                <ProtectedRoute>
                  <ProjectAnalysis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId/analysis/:analysisId/pair"
              element={
                <ProtectedRoute>
                  <ImagePairDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/match/:image1/:image2"
              element={
                <ProtectedRoute>
                  <FeatureMatchingTest />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ErrorProvider>
  </QueryClientProvider>
);

export default App;
