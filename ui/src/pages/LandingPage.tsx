import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/demo");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-2xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            追溯图片的数字足迹
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10">
            AI 驱动的图像溯源分析
          </p>
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            className="h-12 px-8 text-base font-medium gap-2 group"
          >
            立即体验
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground relative z-10">
        <p>© 2024 ImageTrace. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
