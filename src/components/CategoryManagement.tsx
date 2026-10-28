import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SquaresFour, Calendar, Plus, Trash, PencilSimple, Check, X } from "@phosphor-icons/react";
import { useGym, generateId, addAudit, categoryLabelOf } from "../context/GymContext";
import { ALL_DAYS, WEEK_DAYS } from "../constants";
import type { AccessRule, CategoryLabel, CustomerCategory } from "../types";
import { toast } from "sonner";
import { createCategory, updateCategory, deleteCategory, PROTECTED_SYSTEM_CATEGORIES } from "../services/categories";

const DAY_OPTIONS = [...WEEK_DAYS, ALL_DAYS];
const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";
const BTN = "bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-lime-300";
const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";

function Chip({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{children}</button>
  );
}

/* ------------------ 1. Editable customer categories ------------------ */
function CategoryLabelsPanel() {
  const { state, dispatch } = useGym();
  const [editing, setEditing] = useState<CustomerCategory | null>(null);
  const [draft, setDraft] = useState({ label: "", description: "" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState({ label: "", key: "", description: "" });
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryLabel | null>(null);

  const startEdit = (c: CategoryLabel) => {
    setEditing(c.category);
    setDraft({ label: c.label, description: c.description });
  };

  const save = async (category: CustomerCategory) => {
    if (!draft.label.trim()) { toast.error("Label is required"); return; }
    try {
      const payload = await updateCategory(category, { label: draft.label, description: draft.description });
      dispatch({ type: "UPDATE_CATEGORY_LABEL", payload });
      addAudit(dispatch, "Category label updated", state.currentUser?.name || "Owner", `${payload.label} (${category})`);
      toast.success("Label and description saved");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category");
    }
  };

  const handleAddCategory = async () => {
    if (!newForm.label.trim()) {
      toast.error("Category name is required");
      return;
    }
    try {
      const newCat = await createCategory({
        label: newForm.label,
        key: newForm.key,
        description: newForm.description,
      });
      dispatch({ type: "ADD_CATEGORY", payload: newCat });
      addAudit(dispatch, "Category created", state.currentUser?.name || "Owner", `${newCat.label} (${newCat.category})`);
      toast.success(`Category "${newCat.label}" created successfully`);
      setNewForm({ label: "", key: "", description: "" });
      setShowAddModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  const promptDelete = (cat: CategoryLabel) => {
    if (PROTECTED_SYSTEM_CATEGORIES.includes(cat.category.toUpperCase())) {
      toast.error(`The standard category "${cat.label}" is required by the gym system and cannot be deleted.`);
      return;
    }
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.category, {
        members: state.members,
        plans: state.plans,
      });
      dispatch({ type: "DELETE_CATEGORY", payload: categoryToDelete.category });
      addAudit(dispatch, "Category deleted", state.currentUser?.name || "Owner", `${categoryToDelete.label} (${categoryToDelete.category})`);
      toast.success(`Category "${categoryToDelete.label}" deleted`);
      setCategoryToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete category");
    }
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <SquaresFour weight="fill" className="w-5 h-5 text-lime-400" /> Customer categories
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Labels and descriptions are editable: they are used everywhere in the app (registration, check-in, member portal, reports).
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className={BTN}>
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.categoryLabels.map(meta => {
          const cat = meta.category;
          const isEditing = editing === cat;
          const count = state.members.filter(m => (m.category || "REGULAR") === cat).length;
          const isProtected = PROTECTED_SYSTEM_CATEGORIES.includes(cat.toUpperCase());

          return (
            <div key={cat} className="bg-zinc-800/50 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {meta.label}
                    {isProtected && (
                      <span className="text-[10px] bg-zinc-700/60 text-zinc-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        System
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono">
                    {cat} · {count} member{count === 1 ? "" : "s"}
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(meta)} className="text-xs text-lime-400 hover:text-lime-300 flex items-center gap-1">
                      <PencilSimple className="w-4 h-4" /> Edit
                    </button>
                    {!isProtected && (
                      <button onClick={() => promptDelete(meta)} className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1" title="Delete category">
                        <Trash className="w-4 h-4" /> Delete
                      </button>
                    )}
                  </div>
                )}
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

      {/* Add Category Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={`${CARD} w-full max-w-lg`} onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Add Customer Category</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Category Name *</label>
                  <input value={newForm.label} onChange={e => setNewForm({ ...newForm, label: e.target.value })} placeholder="e.g. Senior Citizen, VIP, Weekend Pass" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Code / Identifier (optional)</label>
                  <input value={newForm.key} onChange={e => setNewForm({ ...newForm, key: e.target.value })} placeholder="e.g. SENIOR, VIP (auto-generated if empty)" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Description</label>
                  <textarea value={newForm.description} onChange={e => setNewForm({ ...newForm, description: e.target.value })} placeholder="Describe access privileges or conditions..." rows={3} className={`${INPUT} resize-none`} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleAddCategory} className="flex-1 bg-lime-400 text-zinc-950 font-bold py-2.5 rounded-xl hover:bg-lime-300 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Create Category
                  </button>
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-xl bg-zinc-700 text-white font-semibold hover:bg-zinc-600">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Category Confirmation Dialog */}
      <AnimatePresence>
        {categoryToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setCategoryToDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={`${CARD} w-full max-w-md border-red-500/30`} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-2">Delete Customer Category</h3>
              <p className="text-sm text-zinc-300 mb-4">
                Are you sure you want to delete the category <span className="text-lime-400 font-semibold">{categoryToDelete.label}</span> ({categoryToDelete.category})? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={confirmDeleteCategory} className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl hover:bg-red-600 flex items-center justify-center gap-2">
                  <Trash className="w-4 h-4" /> Delete Category
                </button>
                <button onClick={() => setCategoryToDelete(null)} className="px-4 py-2.5 rounded-xl bg-zinc-700 text-white font-semibold hover:bg-zinc-600">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
        {state.categoryLabels.map(meta => {
          const cat = meta.category;
          const rules = state.accessRules.filter(r => r.category === cat);
          return (
            <div key={cat} className="border border-zinc-800 rounded-2xl p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{meta.label}</div>
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
                  {state.categoryLabels.map(c => <option key={c.category} value={c.category}>{c.label}</option>)}
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

export function CategoriesView() {
  return (
    <div className="space-y-6">
      <CategoryLabelsPanel />
      <AccessRulesPanel />
    </div>
  );
}