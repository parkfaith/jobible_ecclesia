"use client";

import { useEffect, useRef, useState } from "react";
import { templatesApi, Template } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    templatesApi.list().then(setTemplates).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!uploadName.trim()) { setError("양식 이름을 입력하세요."); return; }
    if (!uploadFile) { setError("파일을 선택하세요."); return; }
    setError("");
    setUploading(true);
    try {
      await templatesApi.upload(uploadName.trim(), uploadFile);
      setUploadName("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await templatesApi.setDefault(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "설정 실패");
    }
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`"${t.name}" 양식을 삭제하시겠습니까?`)) return;
    try {
      await templatesApi.delete(t.id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">양식 관리</h2>
        <p className="text-sm text-slate-500">회의록 작성에 사용할 .docx 양식을 업로드하세요.</p>
      </div>

      {/* 업로드 영역 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">새 양식 업로드</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="양식 이름"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:text-slate-700 file:bg-white hover:file:bg-slate-50 cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-slate-800 text-white text-sm px-5 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
          >
            {uploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* 양식 목록 */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          업로드된 양식이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">이름</th>
                <th className="px-5 py-3 text-left">등록일</th>
                <th className="px-5 py-3 text-left">상태</th>
                <th className="px-5 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-5 py-3">
                    {t.is_default ? (
                      <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        기본 양식
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {!t.is_default && (
                        <button
                          onClick={() => handleSetDefault(t.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          기본값 설정
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
