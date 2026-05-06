"use client";

import { useEffect, useState } from "react";
import { teamsApi, Team } from "@/lib/api";

type ModalMode = "create" | "edit" | null;

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    teamsApi.list().then(setTeams).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setSelected(null);
    setName("");
    setDescription("");
    setError("");
    setModal("create");
  };

  const openEdit = (team: Team) => {
    setSelected(team);
    setName(team.name);
    setDescription(team.description);
    setError("");
    setModal("edit");
  };

  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("팀 이름을 입력하세요."); return; }
    setSaving(true);
    setError("");
    try {
      if (modal === "create") {
        await teamsApi.create({ name: name.trim(), description: description.trim() });
      } else if (modal === "edit" && selected) {
        await teamsApi.update(selected.id, { name: name.trim(), description: description.trim() });
      }
      await load();
      closeModal();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`"${team.name}" 팀을 삭제하시겠습니까? 관련 회의도 모두 삭제됩니다.`)) return;
    try {
      await teamsApi.delete(team.id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">팀 관리</h2>
        <button
          onClick={openCreate}
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          + 팀 추가
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          등록된 팀이 없습니다. 팀을 추가해주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-base font-semibold text-slate-800 mb-1">{team.name}</div>
              {team.description && (
                <div className="text-sm text-slate-500 mb-3">{team.description}</div>
              )}
              <div className="text-xs text-slate-400 mb-4">
                {new Date(team.created_at).toLocaleDateString("ko-KR")} 생성
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(team)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(team)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-5">
              {modal === "create" ? "팀 추가" : "팀 수정"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">팀 이름 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예) DX팀, 개발팀"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="팀 설명 (선택)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={closeModal}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
