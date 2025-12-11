import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X, Image as ImageIcon, LogOut, LayoutDashboard } from "lucide-react";
import { useState } from "react";

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/landing");
  };

  const isLandingPage = location.pathname === "/landing";
  const isDashboard = location.pathname === "/dashboard" || location.pathname.startsWith("/project/");

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/landing")}
          >
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">ImageTrace</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => navigate("/landing")}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isLandingPage ? "text-primary" : "text-muted-foreground"
              }`}
            >
              首页
            </button>
            <button 
              onClick={() => navigate("/demo")}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === "/demo" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              在线演示
            </button>
            {user && (
              <button 
                onClick={() => navigate("/dashboard")}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isDashboard ? "text-primary" : "text-muted-foreground"
                }`}
              >
                控制台
              </button>
            )}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  控制台
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/auth")}
                >
                  登录
                </Button>
                <Button 
                  size="sm"
                  onClick={() => navigate("/auth")}
                >
                  免费注册
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => { navigate("/landing"); setMobileMenuOpen(false); }}
                className="px-4 py-2 text-left text-foreground hover:bg-muted rounded-md"
              >
                首页
              </button>
              <button 
                onClick={() => { navigate("/demo"); setMobileMenuOpen(false); }}
                className="px-4 py-2 text-left text-foreground hover:bg-muted rounded-md"
              >
                在线演示
              </button>
              {user && (
                <button 
                  onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                  className="px-4 py-2 text-left text-foreground hover:bg-muted rounded-md"
                >
                  控制台
                </button>
              )}
              <div className="border-t border-border my-2" />
              {user ? (
                <button 
                  onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                  className="px-4 py-2 text-left text-destructive hover:bg-muted rounded-md"
                >
                  退出登录
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
                    className="px-4 py-2 text-left text-foreground hover:bg-muted rounded-md"
                  >
                    登录
                  </button>
                  <Button 
                    className="mx-4"
                    onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
                  >
                    免费注册
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
