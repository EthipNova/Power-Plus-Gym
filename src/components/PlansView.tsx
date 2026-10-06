import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightning, PencilSimple, Plus } from "@phosphor-icons/react";
import { useGym, formatETB, generateId, addAudit, categoryLabelOf, planCategoryText } from "../context/GymContext";
import { ALL_CATEGORIES } from "../constants";
import type { CustomerCategory, Plan } from "../types";
import { toast } from "sonner";

const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";
const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";

type FormState = { name: string; price: number; durationDays: number; perks: string; applyAll: boolean; cats: CustomerCategory[] };

const emptyForm = (): FormState => ({ name: "", price: 0, durationDays: 30, perks: "", applyAll: true, cats: [] });

export function PlansView() {
  const { state, dispatch } = useGym();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const toggleCat = (cat: CustomerCategory) => {
    setForm(f => ({ ...f, cats: f.cats.includes(cat) ? f.cats.filter(c => c !== cat) : [...f.cats, cat] }));
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      perks: plan.perks.join(", "),
      applyAll: plan.applicableCategories === "ALL",
      cats: plan.applicableCategories === "ALL" ? [] : plan.applicableCategories,
    });
    setShowForm(true);
  };

  const savePlan = () => {
    if (!form.name.trim() || form.price <= 0) { toast.error("Enter a name and a valid price"); return; }
    if (!form.applyAll && form.cats.length === 0) { toast.error("Select at least one customer category"); return; }
    const base = {
      name: form.name.trim(),
      price: form.price,
      durationDays: form.durationDays,
      perks: form.perks.split(",").map(s => s.trim()).filter(Boolean),
      applicableCategories: (form.applyAll ? "ALL" : form.cats) as Plan["applicableCategories"],
    };
    const planData: Plan = editing ? { ...editing, ...base } : { ...base, id: generateId("p"), active: true };
    dispatch({ type: editing ? "UPDATE_PLAN" : "ADD_PLAN", payload: planData });
    addAudit(dispatch, editing ? "Plan updated" : "Plan created", state.currentUser?.name || "Owner", `${planData.name} · ${formatETB(planData.price)} · ${planCategoryText(state, planData)}`);
    toast.success(editing ? "Plan updated" : "Plan created");
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold">Membership plans</h2>
          <p className="text-sm text-zinc-500">Each plan is linked to the customer categories allowed to subscribe to it.</p>
        </div>
        <button onClick={openCreate} className="bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-lime-300 whitespace-nowrap"><Plus className="w-4 h-4" /> New plan</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.plans.map(plan => (
          <div key={plan.id} className={`${CARD} ${plan.active ? "" : "opacity-50"}`}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${plan.active ? "bg-lime-400/20 text-lime-400" : "bg-zinc-700 text-zinc-400"}`}>{plan.active ? "Active" : "Inactive"}</span>
            </div>
            <div className="text-2xl font-black text-lime-400 mb-1">{formatETB(plan.price)}</div>
            <div className="text-sm text-zinc-500 mb-3">{plan.durationDays} days</div>
            <div className="text-xs mb-3 flex items-center gap-2 text-zinc-400"><Lightning weight="fill" className="w-4 h-4 text-lime-400" /> {planCategoryText(state, plan)}</div>
            <div className="flex flex-wrap gap-1 mb-4">{plan.perks.map(p => <span key={p} className="text-xs bg-zinc-800 px-2 py-1 rounded">{p}</span>)}</div>
            <div className="flex gap-4 text-sm">
              <button onClick={() => openEdit(plan)} className="text-zinc-400 hover:text-white flex items-center gap-1"><PencilSimple className="w-4 h-4" /> Edit</button>
              <button onClick={() => { dispatch({ type: "UPDATE_PLAN", payload: { ...plan, active: !plan.active } }); toast.success(plan.active ? "Plan deactivated" : "Plan activated"); }} className="text-zinc-400 hover:text-white">{plan.active ? "Deactivate" : "Activate"}</button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={`${CARD} w-full max-w-md max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">{editing ? "Edit plan" : "New plan"}</h3>
              <div className="space-y-3">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Plan name" className={INPUT} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={form.price || ""} onChange={e => setForm({ ...form, price: Number(e.target.value) })} placeholder="Price (Br)" className={INPUT} />
                  <input type="number" value={form.durationDays || ""} onChange={e => setForm({ ...form, durationDays: Number(e.target.value) })} placeholder="Duration (days)" className={INPUT} />
                </div>
                <textarea value={form.perks} onChange={e => setForm({ ...form, perks: e.target.value })} placeholder="Perks (comma-separated)" rows={2} className={`${INPUT} resize-none`} />
                <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Eligible categories</div>
                  <label className="flex items-center gap-2 text-sm text-zinc-200"><input type="checkbox" checked={form.applyAll} onChange={e => setForm({ ...form, applyAll: e.target.checked })} className="accent-lime-400" /> All categories</label>
                  {!form.applyAll && (
                    <div className="flex flex-wrap gap-2">
                      {ALL_CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => toggleCat(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${form.cats.includes(cat) ? "bg-lime-400 text-zinc-950" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}>{categoryLabelOf(state, cat)}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={savePlan} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300">{editing ? "Update" : "Create plan"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}