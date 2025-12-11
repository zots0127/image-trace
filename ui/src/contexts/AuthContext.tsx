/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type LocalUser = { email: string };
type AnyUser = User | LocalUser | null;

interface AuthContextType {
  user: AnyUser;
  session: Session | null;
  loading: boolean;
  offline: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGithub: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "image-trace-local-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AnyUser>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const loadLocalUser = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as LocalUser;
      } catch {
        return null;
      }
    }
    return null;
  };

  const persistLocalUser = (u: LocalUser | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
          setSession(sess);
          setUser(sess?.user ?? loadLocalUser());
          setLoading(false);
        });
        unsub = () => subscription.unsubscribe();

        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? loadLocalUser());
        setOffline(false);
      } catch {
        // Supabase 不可用：进入离线模式
        setOffline(true);
        setUser(loadLocalUser());
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, []);

  const signUp = async (email: string, password: string) => {
    if (offline) {
      const u = { email };
      setUser(u);
      persistLocalUser(u);
      toast({ title: t("toast.offlineSignUp"), description: t("toast.offlineSignUp") });
      return { error: null };
    }
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (!error) {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      toast({ title: t("toast.signUpSuccess") });
    }
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (offline) {
      const u = { email };
      setUser(u);
      persistLocalUser(u);
      toast({ title: t("toast.offlineSignIn"), description: t("toast.offlineSignIn") });
      return { error: null };
    }
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      persistLocalUser(null); // 清除本地假账户
      toast({ title: t("toast.signInSuccess"), description: t("common.welcomeBack") });
    }
    return { error };
  };

  const signInWithGithub = async () => {
    if (offline) {
      const u = { email: "offline-github@example.com" };
      setUser(u);
      persistLocalUser(u);
      toast({ title: "离线 GitHub 登录", description: "已使用本地模式" });
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast({ title: t("toast.githubFailed"), description: error.message, variant: "destructive" });
    }
    return { error };
  };

  const signOut = async () => {
    if (!offline) {
      await supabase.auth.signOut().catch(() => {});
    }
    setSession(null);
    setUser(null);
    persistLocalUser(null);
    toast({ title: t("toast.signOut") });
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, offline, signUp, signIn, signInWithGithub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
