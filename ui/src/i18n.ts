import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const STORAGE_KEY = "image-trace-lang";

const detectInitialLng = () => {
  if (typeof window === "undefined") return "zh";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  const nav = navigator.language || "";
  if (nav.toLowerCase().startsWith("en")) return "en";
  if (nav.toLowerCase().startsWith("zh")) return "zh";
  return "zh";
};

const resources = {
  en: {
    translation: {
      common: {
        appName: "Image Trace",
        signIn: "Sign In",
        signUp: "Sign Up",
        email: "Email",
        password: "Password",
        or: "OR",
        loginWithGithub: "Sign in with GitHub",
        registerWithGithub: "Sign up with GitHub",
        welcomeBack: "Welcome back!",
        fillAllFields: "Please fill all fields",
        passwordTooShort: "Password too short",
        passwordRequirement: "Password must be at least 6 characters",
        logout: "Sign out",
        offlineMode: "Offline mode: usable without account",
        onlineTip: "Sign in or register to start",
        dashboard: "Dashboard",
        demo: "Demo",
      },
      toast: {
        signInSuccess: "Signed in successfully",
        signUpSuccess: "Sign up succeeded, check verification email",
        signOut: "Signed out",
        offlineSignIn: "Offline sign-in succeeded",
        offlineSignUp: "Offline sign-up succeeded",
        offlineGithub: "Offline GitHub sign-in",
        githubFailed: "GitHub login failed",
      },
    },
  },
  zh: {
    translation: {
      common: {
        appName: "图像溯源分析系统",
        signIn: "登录",
        signUp: "注册",
        email: "邮箱",
        password: "密码",
        or: "或",
        loginWithGithub: "使用 GitHub 登录",
        registerWithGithub: "使用 GitHub 注册",
        welcomeBack: "欢迎回来！",
        fillAllFields: "请填写所有字段",
        passwordTooShort: "密码过短",
        passwordRequirement: "密码至少需要6个字符",
        logout: "退出登录",
        offlineMode: "离线模式：无需账号可本地使用",
        onlineTip: "登录或注册以开始使用",
        dashboard: "控制台",
        demo: "在线演示",
      },
      toast: {
        signInSuccess: "登录成功",
        signUpSuccess: "注册成功，请查收验证邮件",
        signOut: "已退出登录",
        offlineSignIn: "离线登录成功",
        offlineSignUp: "离线注册成功",
        offlineGithub: "离线 GitHub 登录",
        githubFailed: "GitHub 登录失败",
      },
    },
  },
};

const fallbackLng = "zh";
const initialLng = detectInitialLng();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng,
  interpolation: {
    escapeValue: false,
  },
});

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    try {
      localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      // ignore storage errors
    }
  });
}

export default i18n;
