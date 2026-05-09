"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  meetingsApi,
  MeetingDetail,
  MeetingFile,
  STATUS_COLOR,
  STATUS_LABEL,
  STT_STATUS_COLOR,
  STT_STATUS_LABEL,
} from "@/lib/api";

function fileName(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/^[a-f0-9]{32}_/, "") ?? path;
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = Number(id);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadMeeting = useCallback(async () => {
    const data = await meetingsApi.get(meetingId);
    const sortedFiles = [...(data.files ?? [])].sort((a, b) => a.file_order - b.file_order);
    setMeeting(data);
    setFiles(sortedFiles);
  }, [meetingId]);

  useEffect(() => {
    loadMeeting()
      .catch(() => setError("회의를 찾을 수 없습니다."))
      .finally(() => setLoading(false));
  }, [loadMeeting]);

  const hasActiveStt = useMemo(
    () => files.some((file) => file.stt_status === "pending" || file.stt_status === "processing"),
    [files]
  );

  useEffect(() => {
    if (!hasActiveStt) return;
    const timer = window.setInterval(() => {
      loadMeeting().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [hasActiveStt, loadMeeting]);

  const handleDelete = async () => {
    if (!meeting) return;
    if (!confirm(`"${meeting.title}" 회의를 삭제하시겠습니까?`)) return;
    await meetingsApi.delete(meeting.id);
    router.push("/meetings");
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError("업로드할 음성 파일을 선택하세요.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await meetingsApi.uploadFiles(meetingId, selectedFiles);
      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMeeting();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async (fileId: number) => {
    setError("");
    try {
      await meetingsApi.retryStt(meetingId, fileId);
      await loadMeeting();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "STT 재처리 요청 실패");
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (error && !meeting) return <div className="text-red-500 text-sm">{error}</div>;
  if (!meeting) return <div className="text-red-500 text-sm">회의를 찾을 수 없습니다.</div>;

  const attendees: string[] = JSON.parse(meeting.attendees || "[]");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href="/meetings" className="hover:text-slate-600">
          회의 목록
        </Link>
        <span>/</span>
        <span className="text-slate-600">{meeting.title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{meeting.title}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-500">{meeting.team.name}</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">{meeting.date}</span>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[meeting.status]}`}
            >
              {STATUS_LABEL[meeting.status]}
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
        >
          삭제
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            기본 정보
          </h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400 mb-0.5">팀</dt>
              <dd className="font-medium text-slate-800">{meeting.team.name}</dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-0.5">날짜</dt>
              <dd className="font-medium text-slate-800">{meeting.date}</dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-0.5">양식</dt>
              <dd className="font-medium text-slate-800">
                {meeting.template ? meeting.template.name : "없음"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-0.5">상태</dt>
              <dd>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[meeting.status]}`}
                >
                  {STATUS_LABEL[meeting.status]}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            참석자
          </h3>
          {attendees.length === 0 ? (
            <span className="text-sm text-slate-400">등록된 참석자가 없습니다.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attendees.map((attendee) => (
                <span
                  key={attendee}
                  className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full"
                >
                  {attendee}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              음성 파일
            </h3>
            {hasActiveStt && <span className="text-xs text-blue-600">STT 처리 상태 갱신 중</span>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".mp3,.wav,.m4a,.mp4,.mpeg,.mpga,.webm,.ogg,.flac,audio/*"
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:text-slate-700 file:bg-white hover:file:bg-slate-50 cursor-pointer flex-1"
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-slate-800 text-white text-sm px-5 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
              >
                {uploading ? "업로드 중..." : "업로드 및 STT 시작"}
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="bg-white rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              아직 업로드된 음성 파일이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {file.file_order}. {fileName(file.audio_path)}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(file.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STT_STATUS_COLOR[file.stt_status]}`}
                      >
                        {STT_STATUS_LABEL[file.stt_status]}
                      </span>
                      {file.stt_status === "error" && (
                        <button
                          onClick={() => handleRetry(file.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          재시도
                        </button>
                      )}
                    </div>
                  </div>

                  {file.stt_transcript && (
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {file.stt_transcript}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            회의록
          </h3>
          <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400">
            Phase 3~5에서 화자 분리, 회의록 생성, Word 파일 출력을 구현할 예정입니다.
          </div>
        </div>
      </div>
    </div>
  );
}
