-- 图片溯源分析系统数据表

-- 1. 项目表
CREATE TABLE public.image_trace_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  image_count INTEGER NOT NULL DEFAULT 0,
  analysis_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. 图片表
CREATE TABLE public.image_trace_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.image_trace_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  storage_path TEXT,
  public_url TEXT,
  thumbnail_url TEXT,
  hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. 文档表（用于从PDF等提取图片）
CREATE TABLE public.image_trace_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.image_trace_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_images_count INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. 分析结果表
CREATE TABLE public.image_trace_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.image_trace_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'fast',
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  similarity_matrix JSONB,
  image_ids UUID[],
  features JSONB,
  summary JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. 分享报告表
CREATE TABLE public.image_trace_shared_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.image_trace_projects(id) ON DELETE SET NULL,
  analysis_id UUID REFERENCES public.image_trace_analyses(id) ON DELETE SET NULL,
  share_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_image_trace_projects_user_id ON public.image_trace_projects(user_id);
CREATE INDEX idx_image_trace_images_project_id ON public.image_trace_images(project_id);
CREATE INDEX idx_image_trace_images_user_id ON public.image_trace_images(user_id);
CREATE INDEX idx_image_trace_documents_project_id ON public.image_trace_documents(project_id);
CREATE INDEX idx_image_trace_analyses_project_id ON public.image_trace_analyses(project_id);
CREATE INDEX idx_image_trace_shared_reports_share_id ON public.image_trace_shared_reports(share_id);
CREATE INDEX idx_image_trace_shared_reports_user_id ON public.image_trace_shared_reports(user_id);

-- 启用 RLS
ALTER TABLE public.image_trace_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_trace_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_trace_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_trace_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_trace_shared_reports ENABLE ROW LEVEL SECURITY;

-- RLS 策略: 项目表
CREATE POLICY "Users can view their own projects" ON public.image_trace_projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own projects" ON public.image_trace_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.image_trace_projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.image_trace_projects
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略: 图片表
CREATE POLICY "Users can view their own images" ON public.image_trace_images
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own images" ON public.image_trace_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own images" ON public.image_trace_images
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略: 文档表
CREATE POLICY "Users can view their own documents" ON public.image_trace_documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own documents" ON public.image_trace_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.image_trace_documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.image_trace_documents
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略: 分析结果表
CREATE POLICY "Users can view their own analyses" ON public.image_trace_analyses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own analyses" ON public.image_trace_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own analyses" ON public.image_trace_analyses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own analyses" ON public.image_trace_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略: 分享报告表
CREATE POLICY "Users can view their own shared reports" ON public.image_trace_shared_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view active public shared reports" ON public.image_trace_shared_reports
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Users can create their own shared reports" ON public.image_trace_shared_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own shared reports" ON public.image_trace_shared_reports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shared reports" ON public.image_trace_shared_reports
  FOR DELETE USING (auth.uid() = user_id);

-- 更新时间触发器
CREATE TRIGGER update_image_trace_projects_updated_at
  BEFORE UPDATE ON public.image_trace_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();