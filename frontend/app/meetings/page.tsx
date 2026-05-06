"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { meetingsApi, teamsApi, Meeting, Team, STATUS_LABEL, STATUS_COLOR } from "@/lib/api";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = (teamId?: number) =>
    meetingsApi
      .list(teamId ? { team_id: teamId } : undefined)
      .then(setMeetings)
      .finally(() => setLoading(false));

  useEffect(() => {
    Promise.all([teamsApi.list(), meetingsApi.list()]).then(([t, m]) => {
      setTeams(t);
      setMeetings(m);
      setLoading(false);
    });
  }, []);

  const handleFilterChange = (teamId: string) => {
    setSelectedTeam(teamId);
    setLoading(true);
    load(teamId ? Number(teamId) : undefined);
  };

  const handleDelete = async (m: Meeting) => {
    if (!confirm(`"${m.title}" 회의를 삭제하시겠습니까?`)) return;
    try {
      await meetingsApi.delete(m.id);
      load(selectedTeam ? Number(selectedTeam) : undefined);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const teamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name ?? "-";

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">회의 목록</h2>
        <Link
          href="/meetings/new"
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          + 새 회의
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4">
        <select
          value={selectedTeam}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">전체 팀</option>
          {teams.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          회의가 없습니다.{" "}
          <Link href="/meetings/new" className="text-slate-600 underline">
            새 회의를 등록하세요.
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">제목</th>
                <th className="px-5 py-3 text-left">팀</th>
                <th className="px-5 py-3 text-left">날짜</th>
                <th className="px-5 py-3 text-left">상태</th>
                <th className="px-5 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/meetings/${m.id}`}
                      className="font-medium text-slate-800 hover:text-slate-600"
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{teamName(m.team_id)}</td>
                  <td className="px-5 py-3 text-slate-500">{m.date}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[m.status]}`}
                    >
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/meetings/${m.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        상세
                      </Link>
                      <button
                        onClick={() => handleDelete(m)}
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
