"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { meetingsApi, MeetingDetail, STATUS_LABEL, STATUS_COLOR } from "@/lib/api";

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    meetingsApi
      .get(Number(id))
      .then(setMeeting)
      .catch(() => setError("회의를 찾을 수 없습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!meeting) return;
    if (!confirm(`"${meeting.title}" 회의를 삭제하시겠습니까?`)) return;
    await meetingsApi.delete(meeting.id);
    router.push("/meetings");
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (error || !meeting) return <div className="text-red-500 text-sm">{error}</div>;

  const attendees: string[] = JSON.parse(meeting.attendees || "[]");

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href="/meetings" className="hover:text-slate-600">회의 목록</Link>
        <span>/</span>
        <span className="text-slate-600">{meeting.title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{meeting.title}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-500">{meeting.team.name}</span>
            <span className="text-slate-300">•</span>
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

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {/* 기본 정보 */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">기본 정보</h3>
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

        {/* 참석자 */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">참석자</h3>
          {attendees.length === 0 ? (
            <span className="text-sm text-slate-400">등록된 참석자 없음</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attendees.map((a) => (
                <span
                  key={a}
                  className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Phase 2~5 플레이스홀더 */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">녹음 파일</h3>
          <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400">
            Phase 2에서 구현 예정 — 음성 파일 업로드 및 STT 처리
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">회의록</h3>
          <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400">
            Phase 3~5에서 구현 예정 — 화자 분리, 회의록 생성, Word 파일 출력
          </div>
        </div>
      </div>
    </div>
  );
}
