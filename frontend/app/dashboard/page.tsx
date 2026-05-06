"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { teamsApi, meetingsApi, Team, Meeting, STATUS_LABEL, STATUS_COLOR } from "@/lib/api";

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([teamsApi.list(), meetingsApi.list()])
      .then(([t, m]) => {
        setTeams(t);
        setMeetings(m.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">대시보드</h2>
        <Link
          href="/meetings/new"
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          + 새 회의
        </Link>
      </div>

      {/* 팀 카드 */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          팀 현황 ({teams.length})
        </h3>
        {teams.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
            등록된 팀이 없습니다.{" "}
            <Link href="/teams" className="text-slate-600 underline">
              팀 관리
            </Link>
            에서 팀을 추가하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="text-base font-semibold text-slate-800">{team.name}</div>
                {team.description && (
                  <div className="text-sm text-slate-500 mt-1">{team.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 최근 회의 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          최근 회의
        </h3>
        {meetings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
            등록된 회의가 없습니다.{" "}
            <Link href="/meetings/new" className="text-slate-600 underline">
              새 회의
            </Link>
            를 등록하세요.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">제목</th>
                  <th className="px-5 py-3 text-left">날짜</th>
                  <th className="px-5 py-3 text-left">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetings.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/meetings/${m.id}`}
                        className="text-slate-800 hover:text-slate-600 font-medium"
                      >
                        {m.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{m.date}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[m.status]}`}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
