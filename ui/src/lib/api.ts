import { supabase } from "@/integrations/supabase/client";
import { APIError } from "./errorHandler";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // 离线模式或未配置 Supabase：忽略
  }
  return {};
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  image_count?: number;
}

export interface Image {
  id: number;
  filename: string;
  file_path: string;
  file_size?: number;
  phash?: string;
  dhash?: string | null;
  ahash?: string | null;
  whash?: string | null;
  extracted_from?: string | null;
  project_id?: number;
  created_at?: string;
  public_url?: string;
}

function toStaticUrl(filePath: string): string {
  const sanitized = String(filePath || "").startsWith("data/")
    ? String(filePath).slice("data/".length)
    : String(filePath || "");
  return `${API_BASE_URL.replace(/\/$/, "")}/static/${sanitized}`;
}

export interface Document {
  id: string;
  filename: string;
  status: "completed" | "failed";
  project_id: number;
  extracted_images_count?: number;
  images?: Image[];
  error?: string;
}

export interface AnalysisResult {
  project_id: number;
  total_images: number;
  groups: Array<{
    group_id: number;
    similarity_score: number;
    images: Image[];
  }>;
  unique_images: Image[];
}

// Projects
export const createProject = async (name: string, description?: string): Promise<Project> => {
  const endpoint = `${API_BASE_URL}/projects`;
  const headers = { ...getJsonHeaders(), ...(await getAuthHeaders()) };
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(
      error.detail || "创建项目失败",
      response.status,
      endpoint,
      error
    );
  }
  return response.json();
};

export const getProjects = async (): Promise<Project[]> => {
  const endpoint = `${API_BASE_URL}/projects`;
  try {
    const response = await fetch(endpoint, { headers: await getAuthHeaders() });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new APIError(
        error.detail || "获取项目列表失败",
        response.status,
        endpoint,
        error
      );
    }
    return response.json();
  } catch (error) {
    console.error("API请求失败:", error);
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      "无法连接到后端服务，请检查网络或后端是否运行",
      0,
      endpoint,
      error
    );
  }
};

export const getProject = async (projectId: string): Promise<Project> => {
  const endpoint = `${API_BASE_URL}/projects/${projectId}`;
  const response = await fetch(endpoint, { headers: await getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(
      error.detail || "获取项目详情失败",
      response.status,
      endpoint,
      error
    );
  }
  return response.json();
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const endpoint = `${API_BASE_URL}/projects/${projectId}`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(
      error.detail || "删除项目失败",
      response.status,
      endpoint,
      error
    );
  }
};

// Images - Upload batch
export const uploadImages = async (projectId: string, files: File[]): Promise<Image[]> => {
  const endpoint = `${API_BASE_URL}/upload`;
  const results: Image[] = [];
  const authHeaders = await getAuthHeaders();

  for (const file of files) {
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("file", file);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: authHeaders,
      body: fd,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new APIError(
        error.detail || "上传图片失败",
        response.status,
        endpoint,
        error
      );
    }
    const data = await response.json();
    // data.processed_images 中只有 id/filename/file_path
    if (Array.isArray(data.processed_images)) {
      data.processed_images.forEach((img: any) => {
        results.push({
          id: img.id,
          filename: img.filename,
          file_path: img.file_path || img.filename,
          project_id: Number(projectId),
        });
      });
    } else {
      results.push({
        id: data.id ?? Date.now(),
        filename: data.filename,
        file_path: data.file_path,
        project_id: Number(projectId),
      });
    }
  }

  return results;
};

// Legacy single image upload for backward compatibility
export const uploadImage = async (projectId: string, file: File): Promise<Image> => {
  const results = await uploadImages(projectId, [file]);
  return results[0];
};

// Documents - Upload
export const uploadDocument = async (projectId: string, file: File): Promise<Document> => {
  // 后端 /upload 会同步提取图片，返回 processed_images
  const imgs = await uploadImages(projectId, [file]);
  return {
    id: `${Date.now()}`,
    filename: file.name,
    status: "completed",
    project_id: Number(projectId),
    extracted_images_count: imgs.length,
    images: imgs,
  };
};

// Get document status
export const getDocument = async (documentId: string): Promise<Document> => {
  // 简化后端没有文档状态接口，直接返回 completed
  return {
    id: documentId,
    filename: "",
    status: "completed",
    project_id: 0,
    extracted_images_count: 0,
  };
};

// Get project documents
export const getProjectDocuments = async (projectId: string): Promise<Document[]> => {
  return [];
};

export const getProjectImages = async (projectId: string): Promise<Image[]> => {
  const endpoint = `${API_BASE_URL}/images/${projectId}`;
  const response = await fetch(endpoint, { headers: await getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(
      error.detail || "获取图片列表失败",
      response.status,
      endpoint,
      error
    );
  }
  const data: Image[] = await response.json();
  return data.map((img) => ({
    ...img,
    public_url: toStaticUrl(img.file_path),
  }));
};

export const deleteImage = async (projectId: string, imageId: string): Promise<void> => {
  const endpoint = `${API_BASE_URL}/images/${imageId}`;
  const response = await fetch(endpoint, { method: "DELETE", headers: await getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(
      error.detail || "删除图片失败",
      response.status,
      endpoint,
      error
    );
  }
};

// Analysis
export const analyzeImages = async (
  projectId: string,
  algorithm: "fast" | "orb" | "hybrid" = "fast",
  threshold = 0.85,
  hashType = "phash"
): Promise<AnalysisResult> => {
  const endpoint = `${API_BASE_URL}/compare/${projectId}`;
  const fd = new FormData();
  fd.append("threshold", String(threshold));
  fd.append("hash_type", hashType);
  const headers = await getAuthHeaders();
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(
      error.detail || "启动分析失败",
      response.status,
      endpoint,
      error
    );
  }
  return response.json();
};

// Get analysis status
export const getAnalysisStatus = async (analysisId: string): Promise<AnalysisResult> => {
  // 简化后端没有异步任务，直接返回比对结果（重用 analyzeImages）
  return analyzeImages(analysisId as any, "fast");
};

// Get analysis results
export const getAnalysisResult = async (analysisId: string): Promise<AnalysisResult> => {
  return analyzeImages(analysisId as any, "fast");
};

// Legacy function for backward compatibility
export const getAnalysisResults = async (projectId: string): Promise<AnalysisResult[]> => {
  const r = await analyzeImages(projectId as any, "fast");
  return [r];
};

export const checkHealth = async (): Promise<{ status: string }> => {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) throw new Error("Health check failed");
  return response.json();
};
