"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { teamsApi, templatesApi, meetingsApi, Team, Template } from "@/lib/api";

export default function NewMeetingPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [teamId, setTeamId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([teamsApi.list(), templatesApi.list()])
      .then(([t, tpl]) => {
        setTeams(t);
        setTemplates(tpl);
        const defaultTpl = tpl.find((x) => x.is_default);
        if (defaultTpl) setTemplateId(String(defaultTpl.id));
      })
      .finally(() => setLoading(false));
  }, []);

  const addAttendee = () => {
    const trimmed = attendeeInput.trim();
    if (trimmed && !attendees.includes(trimmed)) {
      setAttendees([...attendees, trimmed]);
    }
    setAttendeeInput("");
  };

  const removeAttendee = (name: string) =>
    setAttendees(attendees.filter((a) => a !== name));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) { setError("팀을 선택하세요."); return; }
    if (!title.trim()) { setError("회의 제목을 입력하세요."); return; }
    if (!date) { setError("날짜를 입력하세요."); return; }
    setError("");
    setSaving(true);
    try {
      const m = await meetingsApi.create({
        team_id: Number(teamId),
        template_id: templateId ? Number(templateId) : undefined,
        title: title.trim(),
        date,
        attendees,
      });
      router.push(`/meetings/${m.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "생성 실패");
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">새 회의 등록</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {/* 팀 선택 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">팀 *</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">팀을 선택하세요</option>
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* 회의 제목 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">회의 제목 *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) DX정기미팅 5월 2주차"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {/* 날짜 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">날짜 *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {/* 참석자 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">참석자</label>
          <div className="flex gap-2 mb-2">
            <input
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAttendee())}
              placeholder="이름 입력 후 Enter 또는 추가"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="button"
              onClick={addAttendee}
              className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              추가
            </button>
          </div>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attendees.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full"
                >
                  {a}
                  <button
                    type="button"
                    onClick={() => removeAttendee(a)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 양식 */}
        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">회의록 양식</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">양식 없음</option>
              {templates.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}{t.is_default ? " (기본)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "등록 중..." : "회의 등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
