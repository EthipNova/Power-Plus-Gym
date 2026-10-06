import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SquaresFour, Calendar, Users, Plus, Trash, PencilSimple, Check, X } from "@phosphor-icons/react";
import { useGym, generateId, addAudit, categoryLabelOf } from "../context/GymContext";
import { ALL_CATEGORIES, ALL_DAYS, WEEK_DAYS } from "../constants";
import type { AccessRule, AerobicsGroup, CategoryLabel, CustomerCategory } from "../types";
import { toast } from "sonner";

const DAY_OPTIONS = [...WEEK_DAYS, ALL_DAYS];
const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";
const BTN = "bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-lime-300";
const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";

function Chip({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{children}</button>
  );
}

/* ------------------ 1. Editable category labels ------------------ */
function CategoryLabelsPanel() {
  const { state, dispatch } = useGym();
  const [editing, setEditing] = useState<CustomerCategory | null>(null);
  const [draft, setDraft] = useState({ label: "", description: "" });

  const startEdit = (c: CategoryLabel) => {
    setEditing(c.category);
    setDraft({ label: c.label, description: c.description });
  };

  const save = (category: CustomerCategory) => {
    if (!draft.label.trim()) { toast.error("Label is required"); return; }
    const payload: CategoryLabel = { category, label: draft.label.trim(), description: draft.description.trim() };
    dispatch({ type: "UPDATE_CATEGORY_LABEL", payload });
    addAudit(dispatch, "Category label updated", state.currentUser?.name || "Owner", `${payload.label} (${category})`);
    toast.success("Label and description saved");
    setEditing(null);
  };

  return (
    <div className={CARD}>
      <h3 className="font-bold mb-4 flex items-center gap-2"><SquaresFour weight="fill" className="w-5 h-5 text-lime-400" /> Customer categories</h3>
      <p className="text-sm text-zinc-500 mb-4">Labels and descriptions are editable: they are used everywhere in the app (registration, check-in, member portal, reports).</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_CATEGORIES.map(cat => {
          const meta = state.categoryLabels.find(c => c.category === cat) ?? { category: cat, label: cat, description: "" };
          const isEditing = editing === cat;
          const count = state.members.filter(m => (m.category || "REGULAR") === cat).length;
          return (
            <div key={cat} className="bg-zinc-800/50 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{meta.label}</div>
                  <div className="text-xs text-zinc-500 font-mono">{cat} · {count} member{count === 1 ? "" : "s"}</div>
                </div>
                {!isEditing && <button onClick={() => startEdit(meta)} className="text-xs text-lime-400 hover:text-lime-300 flex items-center gap-1"><PencilSimple className="w-4 h-4" /> Edit</button>}
              </div>
              {isEditing ? (
                <div className="space-y-3">
                  <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} placeholder="Displayed label" className={INPUT} />
                  <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Description (visible to staff and members)" rows={2} className={`${INPUT} resize-none`} />
                  <div className="flex gap-2">
                    <button onClick={() => save(cat)} className="flex-1 bg-lime-400 text-zinc-950 font-bold py-2.5 rounded-xl hover:bg-lime-300 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Save</button>
                    <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-xl bg-zinc-700 text-white font-semibold flex items-center gap-2 hover:bg-zinc-600"><X className="w-4 h-4" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">{meta.description || "No description"}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------ 2. Access rules per category ------------------ */
function AccessRulesPanel() {
  const { state, dispatch } = useGym();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "REGULAR" as CustomerCategory, days: [] as string[], startTime: "06:00", endTime: "10:00", description: "", active: true });

  const toggleDay = (day: string) => {
    setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }));
  };

  const reset = () => {
    setForm({ category: "REGULAR", days: [], startTime: "06:00", endTime: "10:00", description: "", active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const save = () => {
    if (form.days.length === 0) { toast.error("Select at least one day"); return; }
    if (form.startTime >= form.endTime) { toast.error("End time must be after start time"); return; }
    const rule: AccessRule = {
      id: editingId || generateId("ar"),
      category: form.category,
      days: form.days,
      startTime: form.startTime,
      endTime: form.endTime,
      description: form.description.trim() || `Access ${categoryLabelOf(state, form.category)} ${form.startTime}–${form.endTime}`,
      active: form.active,
    };
    dispatch({ type: editingId ? "UPDATE_ACCESS_RULE" : "ADD_ACCESS_RULE", payload: rule });
    addAudit(dispatch, editingId ? "Access rule updated" : "Access rule created", state.currentUser?.name || "Owner", `${categoryLabelOf(state, rule.category)} · ${rule.days.join("/")} ${rule.startTime}–${rule.endTime}`);
    toast.success("Access rule saved");
    reset();
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="font-bold flex items-center gap-2"><Calendar weight="fill" className="w-5 h-5 text-lime-400" /> Access rules by category</h3>
        <button onClick={() => { setForm({ category: "REGULAR", days: [], startTime: "06:00", endTime: "10:00", description: "", active: true }); setEditingId(null); setShowForm(true); }} className={BTN}><Plus className="w-4 h-4" /> New rule</button>
      </div>
      <p className="text-sm text-zinc-500 mb-4">These time slots are applied automatically at check-in: a member outside their slot is denied (with an override option).</p>

      <div className="space-y-3">
        {ALL_CATEGORIES.map(cat => {
          const rules = state.accessRules.filter(r => r.category === cat);
          return (
            <div key={cat} className="border border-zinc-800 rounded-2xl p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{categoryLabelOf(state, cat)}</div>
              {rules.length === 0 ? (
                <p className="text-sm text-zinc-600">No restriction: free access at any time.</p>
              ) : (
                <div className="space-y-2">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 bg-zinc-800/50 rounded-xl px-4 py-2.5">
                      <div>
                        <div className="text-sm font-semibold">{rule.days.join(" / ")} · {rule.startTime}–{rule.endTime}</div>
                        <div className="text-xs text-zinc-500">{rule.description}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { dispatch({ type: "UPDATE_ACCESS_RULE", payload: { ...rule, active: !rule.active } }); toast.success(rule.active ? "Rule disabled" : "Rule enabled"); }} className={`text-xs px-2 py-1 rounded-full ${rule.active ? "bg-lime-400/20 text-lime-400" : "bg-zinc-700 text-zinc-400"}`}>{rule.active ? "Active" : "Inactive"}</button>
                        <button onClick={() => { setForm({ category: rule.category, days: rule.days, startTime: rule.startTime, endTime: rule.endTime, description: rule.description, active: rule.active }); setEditingId(rule.id); setShowForm(true); }} className="text-zinc-400 hover:text-white"><PencilSimple className="w-4 h-4" /></button>
                        <button onClick={() => { dispatch({ type: "DELETE_ACCESS_RULE", payload: rule.id }); addAudit(dispatch, "Access rule deleted", state.currentUser?.name || "Owner", rule.description); toast.success("Rule deleted"); }} className="text-zinc-400 hover:text-red-400"><Trash className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={reset}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={`${CARD} w-full max-w-lg max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">{editingId ? "Edit access rule" : "New access rule"}</h3>
              <div className="space-y-3">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as CustomerCategory })} className={INPUT}>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabelOf(state, c)}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">{DAY_OPTIONS.map(d => <Chip key={d} active={form.days.includes(d)} onClick={() => toggleDay(d)}>{d}</Chip>)}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-zinc-500 block mb-1">Start</label><input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className={INPUT} /></div>
                  <div><label className="text-xs text-zinc-500 block mb-1">End</label><input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className={INPUT} /></div>
                </div>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description shown at reception" className={INPUT} />
                <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="accent-lime-400" /> Rule active</label>
                <button onClick={save} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300">{editingId ? "Update" : "Create rule"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------ 3. Aerobics groups (AEROBICS category) ------------------ */
function AerobicsGroupsPanel() {
  const { state, dispatch } = useGym();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", days: [] as string[], timeSlot: "18:00 - 19:00", trainerId: "", capacity: 20 });
  const aerobicsMembers = state.members.filter(m => (m.category || "REGULAR") === "AEROBICS");

  const toggleDay = (day: string) => setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }));

  const createGroup = () => {
    if (!form.name.trim()) { toast.error("Group name is required"); return; }
    if (form.days.length === 0) { toast.error("Select the group days"); return; }
    const trainer = state.trainers.find(t => t.id === form.trainerId);
    const group: AerobicsGroup = {
      id: generateId("ag"), name: form.name.trim(), days: form.days, timeSlot: form.timeSlot,
      trainerId: form.trainerId, trainerName: trainer?.name || "Unassigned", capacity: form.capacity, memberIds: [],
    };
    dispatch({ type: "ADD_AEROBICS_GROUP", payload: group });
    addAudit(dispatch, "Aerobics group created", state.currentUser?.name || "Owner", `${group.name} · ${group.days.join("/")} ${group.timeSlot}`);
    toast.success("Aerobics group created");
    setForm({ name: "", days: [], timeSlot: "18:00 - 19:00", trainerId: "", capacity: 20 });
    setShowForm(false);
  };

  const addMember = (group: AerobicsGroup, memberId: string) => {
    if (!memberId) return;
    if (group.memberIds.length >= group.capacity) { toast.error("Group capacity reached"); return; }
    const member = state.members.find(m => m.id === memberId);
    dispatch({ type: "UPDATE_AEROBICS_GROUP", payload: { ...group, memberIds: [...group.memberIds, memberId] } });
    if (member) dispatch({ type: "UPDATE_MEMBER", payload: { ...member, aerobicsGroupId: group.id } });
    addAudit(dispatch, "Member assigned to a group", state.currentUser?.name || "Owner", `${member?.name || memberId} → ${group.name}`);
    toast.success(`${member?.name || "Member"} added to group ${group.name}`);
  };

  const removeMember = (group: AerobicsGroup, memberId: string) => {
    const member = state.members.find(m => m.id === memberId);
    dispatch({ type: "UPDATE_AEROBICS_GROUP", payload: { ...group, memberIds: group.memberIds.filter(id => id !== memberId) } });
    if (member) dispatch({ type: "UPDATE_MEMBER", payload: { ...member, aerobicsGroupId: undefined } });
    toast.success("Member removed from group");
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="font-bold flex items-center gap-2"><Users weight="fill" className="w-5 h-5 text-lime-400" /> Aerobics groups</h3>
        <button onClick={() => setShowForm(true)} className={BTN}><Plus className="w-4 h-4" /> New group</button>
      </div>
      <p className="text-sm text-zinc-500 mb-4">{aerobicsMembers.length} member{aerobicsMembers.length === 1 ? "" : "s"} in the {categoryLabelOf(state, "AEROBICS")} category · {state.aerobicsGroups.length} group{state.aerobicsGroups.length === 1 ? "" : "s"}.</p>

      {state.aerobicsGroups.length === 0 && <p className="text-sm text-zinc-600">No group created yet.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.aerobicsGroups.map(group => {
          const available = aerobicsMembers.filter(m => !group.memberIds.includes(m.id));
          return (
            <div key={group.id} className="bg-zinc-800/50 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{group.name}</div>
                  <div className="text-xs text-zinc-500">{group.days.join(" / ")} · {group.timeSlot} · {group.trainerName}</div>
                </div>
                <button onClick={() => { group.memberIds.forEach(id => { const m = state.members.find(mm => mm.id === id); if (m) dispatch({ type: "UPDATE_MEMBER", payload: { ...m, aerobicsGroupId: undefined } }); }); dispatch({ type: "DELETE_AEROBICS_GROUP", payload: group.id }); toast.success("Group deleted"); }} className="text-zinc-400 hover:text-red-400"><Trash className="w-4 h-4" /></button>
              </div>
              <div className="text-xs text-zinc-500">Occupancy : {group.memberIds.length}/{group.capacity}</div>
              <div className="flex flex-wrap gap-2">
                {group.memberIds.map(id => {
                  const m = state.members.find(mm => mm.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-full pl-3 pr-2 py-1 text-xs">
                      {m?.name || id}
                      <button onClick={() => removeMember(group, id)} className="text-zinc-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </span>
                  );
                })}
                {group.memberIds.length === 0 && <span className="text-xs text-zinc-600">No member assigned</span>}
              </div>
              <select value="" onChange={e => addMember(group, e.target.value)} className={INPUT}>
                <option value="">Add a {categoryLabelOf(state, "AEROBICS")} member...</option>
                {available.map(m => <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>)}
              </select>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={`${CARD} w-full max-w-lg`} onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">New aerobics group</h3>
              <div className="space-y-3">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Group name (e.g. Morning aerobics)" className={INPUT} />
                <div className="flex flex-wrap gap-2">{WEEK_DAYS.map(d => <Chip key={d} active={form.days.includes(d)} onClick={() => toggleDay(d)}>{d}</Chip>)}</div>
                <input value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })} placeholder="Time slot (e.g. 18:00 - 19:00)" className={INPUT} />
                <select value={form.trainerId} onChange={e => setForm({ ...form, trainerId: e.target.value })} className={INPUT}>
                  <option value="">Coach (optional)</option>
                  {state.trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} placeholder="Capacity" className={INPUT} />
                <button onClick={createGroup} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300">Create group</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CategoriesView() {
  return (
    <div className="space-y-6">
      <CategoryLabelsPanel />
      <AccessRulesPanel />
      <AerobicsGroupsPanel />
    </div>
  );
}