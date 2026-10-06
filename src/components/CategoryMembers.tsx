import { useState } from "react";
import { Users, Clock, CheckCircle, XCircle, Plus, Trash, GraduationCap, MusicNotes, ShieldCheck, Calendar } from "@phosphor-icons/react";
import { useGym, addAudit, generateId } from "../context/GymContext";
import { ACCESS_DAYS, ALL_DAYS } from "../constants";
import type { AerobicsGroup } from "../types";
import { toast } from "sonner";

/** Phase 2 sections: aerobics groups + student document verification. */
export default function CategoryMembers({ mode }: { mode: "groups" | "students" }) {
  return mode === "students" ? <StudentsSection /> : <GroupsSection />;
}

function GroupsSection() {
  const { state, dispatch } = useGym();
  const actor = state.currentUser?.name || "Owner";
  const [form, setForm] = useState({ name: "", trainerId: state.trainers[0]?.id || "", timeSlot: "18:00 – 19:00", capacity: 20, days: ["Monday", "Wednesday"] as string[] });

  const addGroup = () => {
    if (!form.name.trim()) { toast.error("Group name is required"); return; }
    if (form.days.length === 0) { toast.error("Select at least one class day"); return; }
    const trainer = state.trainers.find(t => t.id === form.trainerId);
    const group: AerobicsGroup = { id: generateId("agp"), name: form.name.trim(), days: form.days, timeSlot: form.timeSlot, trainerId: form.trainerId, trainerName: trainer?.name || "Coach to be assigned", capacity: form.capacity, memberIds: [] };
    dispatch({ type: "ADD_AEROBICS_GROUP", payload: group });
    addAudit(dispatch, "Aerobics group created", actor, `${group.name} · ${group.days.join(", ")}`);
    toast.success("Group created");
    setForm({ ...form, name: "" });
  };

  const toggleMember = (group: AerobicsGroup, memberId: string) => {
    const enrolled = group.memberIds.includes(memberId);
    const memberIds = enrolled ? group.memberIds.filter(id => id !== memberId) : [...group.memberIds, memberId];
    if (!enrolled && memberIds.length > group.capacity) { toast.error("Group capacity reached"); return; }
    dispatch({ type: "UPDATE_AEROBICS_GROUP", payload: { ...group, memberIds } });
    const member = state.members.find(m => m.id === memberId);
    if (member) dispatch({ type: "UPDATE_MEMBER", payload: { ...member, aerobicsGroupId: enrolled ? undefined : group.id } });
    addAudit(dispatch, "Aerobics group enrollment", actor, `${member?.name || memberId} ${enrolled ? "removed from" : "enrolled in"} ${group.name}`);
    toast.success(enrolled ? "Member removed from group" : "Member enrolled in group");
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><MusicNotes weight="fill" className="w-5 h-5 text-lime-400" /> New aerobics group</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Group name" className="md:col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
          <input value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })} placeholder="Time slot (18:00 – 19:00)" className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none" />
          <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} placeholder="Capacity" className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none" />
          <select value={form.trainerId} onChange={e => setForm({ ...form, trainerId: e.target.value })} className="md:col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none">
            {state.trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            {ACCESS_DAYS.filter(d => d !== ALL_DAYS).map(d => (
              <button key={d} type="button" onClick={() => setForm({ ...form, days: form.days.includes(d) ? form.days.filter(x => x !== d) : [...form.days, d] })} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${form.days.includes(d) ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{d.slice(0, 3)}</button>
            ))}
          </div>
        </div>
        <button onClick={addGroup} className="bg-lime-400 text-zinc-950 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 flex items-center gap-2"><Plus className="w-4 h-4" /> Create group</button>
      </div>

      {state.aerobicsGroups.map(group => {
        const eligible = state.members.filter(m => (m.category || "REGULAR") === "AEROBICS");
        return (
          <div key={group.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{group.name}</h3>
                <div className="text-sm text-zinc-500 flex flex-wrap items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {group.days.join(", ")}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {group.timeSlot}</span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {group.memberIds.length}/{group.capacity}</span>
                  <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> {group.trainerName}</span>
                </div>
              </div>
              <button onClick={() => { dispatch({ type: "DELETE_AEROBICS_GROUP", payload: group.id }); toast.success("Group deleted"); }} className="text-red-400 hover:text-red-300"><Trash className="w-5 h-5" /></button>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-400 mb-2">Members in the Aerobics category</h4>
              <div className="flex flex-wrap gap-2">
                {eligible.map(m => {
                  const enrolled = group.memberIds.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => toggleMember(group, m.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors ${enrolled ? "bg-orange-400/20 text-orange-400 border border-orange-400/30" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                      {enrolled ? <CheckCircle weight="fill" className="w-3 h-3" /> : <Plus className="w-3 h-3" />} {m.name}
                    </button>
                  );
                })}
                {eligible.length === 0 && <span className="text-sm text-zinc-500">No Aerobics members registered.</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentsSection() {
  const { state, dispatch } = useGym();
  const actor = state.currentUser?.name || "Owner";
  const students = state.members.filter(m => (m.category || "REGULAR") === "STUDENT");

  const setVerification = (memberId: string, verified: boolean) => {
    const member = state.members.find(m => m.id === memberId);
    dispatch({ type: "SET_STUDENT_VERIFICATION", payload: { memberId, verified, verifiedBy: actor } });
    addAudit(dispatch, verified ? "Student verified" : "Student rejected", actor, `${member?.name || memberId} · ${member?.studentId || "missing student ID"}`);
    toast.success(verified ? `Document verified for ${member?.name || "the member"}` : `Document rejected for ${member?.name || "the member"}`);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg flex items-center gap-2"><GraduationCap weight="fill" className="w-5 h-5 text-lime-400" /> Student document verification</h3>
      {students.length === 0 && <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">No members in the Student category.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {students.map(m => (
          <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold">{m.name}</h4>
                <p className="text-xs text-zinc-500 font-mono">{m.memberId} · {m.phone}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${m.studentVerified ? "bg-lime-400/20 text-lime-400" : "bg-yellow-400/20 text-yellow-400"}`}>{m.studentVerified ? "Verified" : "Pending"}</span>
            </div>
            <div className="text-sm text-zinc-400 space-y-1">
              <div><span className="text-zinc-500">Student ID :</span> {m.studentId || "Not provided"}</div>
              <div><span className="text-zinc-500">Institution :</span> {m.institution || "Not provided"}</div>
              {m.verifiedBy && <div><span className="text-zinc-500">Verified by :</span> {m.verifiedBy} {m.verifiedAt ? `on ${m.verifiedAt}` : ""}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setVerification(m.id, true)} className="flex-1 bg-lime-400 text-zinc-950 font-bold text-sm py-2.5 rounded-xl hover:bg-lime-300 flex items-center justify-center gap-2"><CheckCircle weight="fill" className="w-4 h-4" /> Approve</button>
              <button onClick={() => setVerification(m.id, false)} className="flex-1 bg-zinc-800 text-zinc-200 font-semibold text-sm py-2.5 rounded-xl hover:bg-zinc-700 flex items-center justify-center gap-2"><XCircle weight="fill" className="w-4 h-4" /> Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}