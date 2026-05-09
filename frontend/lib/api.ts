const BASE = "/api";
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "요청 실패");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ──────────────────────────────────────────────
export interface Team {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Template {
  id: number;
  name: string;
  file_path: string;
  is_default: boolean;
  created_at: string;
}

export interface Meeting {
  id: number;
  team_id: number;
  template_id: number | null;
  title: string;
  date: string;
  attendees: string; // JSON string
  status: "pending" | "processing" | "review" | "done";
  created_at: string;
}

export interface MeetingFile {
  id: number;
  meeting_id: number;
  file_order: number;
  audio_path: string;
  stt_transcript: string;
  stt_status: "pending" | "processing" | "done" | "error";
  created_at: string;
}

export interface MeetingDetail extends Meeting {
  team: Team;
  template: Template | null;
  files: MeetingFile[];
}

// ── Teams ──────────────────────────────────────────────
export const teamsApi = {
  list: () => request<Team[]>("/teams"),
  get: (id: number) => request<Team>(`/teams/${id}`),
  create: (body: { name: string; description?: string }) =>
    request<Team>("/teams", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ name: string; description: string }>) =>
    request<Team>(`/teams/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request<void>(`/teams/${id}`, { method: "DELETE" }),
};

// ── Meetings ───────────────────────────────────────────
export const meetingsApi = {
  list: (params?: { team_id?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.team_id) qs.set("team_id", String(params.team_id));
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<Meeting[]>(`/meetings${q ? "?" + q : ""}`);
  },
  get: (id: number) => request<MeetingDetail>(`/meetings/${id}`),
  create: (body: {
    team_id: number;
    template_id?: number;
    title: string;
    date: string;
    attendees?: string[];
  }) => request<Meeting>("/meetings", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Meeting>) =>
    request<Meeting>(`/meetings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  files: (id: number) => request<MeetingFile[]>(`/meetings/${id}/files`),
  uploadFiles: (id: number, files: FileList | File[]) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    return fetch(`${API_ORIGIN}/api/meetings/${id}/files`, { method: "POST", body: form }).then(
      async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail ?? "업로드 실패");
        }
        return res.json() as Promise<MeetingFile[]>;
      }
    );
  },
  retryStt: (meetingId: number, fileId: number) =>
    request<MeetingFile>(`/meetings/${meetingId}/files/${fileId}/stt`, { method: "POST" }),
};

// ── Templates ──────────────────────────────────────────
export const templatesApi = {
  list: () => request<Template[]>("/templates"),
  upload: (name: string, file: File) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    return fetch(`${API_ORIGIN}/api/templates/upload`, { method: "POST", body: form }).then(
      async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail ?? "업로드 실패");
        }
        return res.json() as Promise<Template>;
      }
    );
  },
  setDefault: (id: number) =>
    request<Template>(`/templates/${id}/default`, { method: "PUT" }),
  delete: (id: number) => request<void>(`/templates/${id}`, { method: "DELETE" }),
};

// ── Utils ──────────────────────────────────────────────
export const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  processing: "처리중",
  review: "검토중",
  done: "완료",
};

export const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  done: "bg-green-100 text-green-700",
};

export const STT_STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  processing: "처리 중",
  done: "완료",
  error: "오류",
};

export const STT_STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};
