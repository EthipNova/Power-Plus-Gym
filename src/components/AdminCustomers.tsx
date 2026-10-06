import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { useGym, formatETB, generateId, addAudit, computeMemberStatus, categoryLabelOf } from "../context/GymContext";
import { ALL_CATEGORIES } from "../constants";
import type { Expense, Member, CustomerCategory } from "../types";
import { toast } from "sonner";

const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";
const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const TH = "text-left px-4 py-3";
const STATUS_LABELS: Record<string, string> = { active: "Active", expiring: "Expiring soon", expired: "Expired", inactive: "Inactive", blocked: "Blocked" };
const STATUS_COLORS: Record<string, string> = { active: "bg-lime-400/20 text-lime-400", expiring: "bg-yellow-400/20 text-yellow-400", expired: "bg-red-400/20 text-red-400", inactive: "bg-zinc-400/20 text-zinc-400", blocked: "bg-purple-400/20 text-purple-400" };
const EXPENSE_LABELS: Record<Expense["category"], string> = { rent: "Rent", utilities: "Utilities", equipment: "Equipment", salaries: "Salaries", maintenance: "Maintenance", other: "Other" };
const METHOD_LABELS: Record<string, string> = { telebirr: "Telebirr", cbe_birr: "CBE Birr", cash: "Cash", card: "Card" };
const PAYMENT_TYPE_LABELS: Record<string, string> = { membership: "Membership", renewal: "Renewal", adjustment: "Adjustment" };

export function CustomersView() {
  const { state, dispatch } = useGym();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState<CustomerCategory | "ALL">("ALL");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const actor = state.currentUser?.name || "Owner";

  const filtered = state.members.filter(m => {
    if (catFilter !== "ALL" && (m.category || "REGULAR") !== catFilter) return false;
    if (statusFilter !== "all" && computeMemberStatus(m, state.settings) !== statusFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.phone.includes(search) && !m.memberId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const changeCategory = (member: Member, category: CustomerCategory) => {
    const plan = state.plans.find(p => p.id === member.planId);
    const stillValid = plan ? plan.applicableCategories === "ALL" || plan.applicableCategories.includes(category) : false;
    const updated: Member = { ...member, category };
    dispatch({ type: "UPDATE_MEMBER", payload: updated });
    setSelectedMember(updated);
    addAudit(dispatch, "Member category changed", actor, `${member.name} → ${categoryLabelOf(state, category)}${stillValid ? "" : " (plan needs review)"}`);
    toast.success(stillValid ? "Category updated" : "Category updated — the current plan is no longer eligible");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="w-5 h-5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone or member ID..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value as CustomerCategory | "ALL")} data-testid="admin-category-filter" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none">
          <option value="ALL">All categories</option>
          {ALL_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabelOf(state, c)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50">
              <tr><th className={TH}>Member</th><th className={TH}>Member ID</th><th className={TH}>Category</th><th className={TH}>Plan</th><th className={TH}>Status</th><th className={TH}>Expiry</th><th className={TH}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const status = computeMemberStatus(m, state.settings);
                const plan = state.plans.find(p => p.id === m.planId);
                return (
                  <tr key={m.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3"><div className="font-semibold">{m.name}</div><div className="text-zinc-500 text-xs">{m.phone}</div></td>
                    <td className="px-4 py-3 font-mono text-xs">{m.memberId}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-zinc-800 px-2 py-1 rounded-full">{categoryLabelOf(state, m.category || "REGULAR")}</span></td>
                    <td className="px-4 py-3">{plan?.name || "Not set"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span></td>
                    <td className="px-4 py-3 text-zinc-400">{m.expiryDate}</td>
                    <td className="px-4 py-3"><button onClick={() => setSelectedMember(m)} className="text-lime-400 hover:text-lime-300 text-xs font-semibold">Details</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-zinc-500">No member matches this search</div>}
      </div>
      <AnimatePresence>
        {selectedMember && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedMember(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-xl font-bold">{selectedMember.name}</h3><p className="text-zinc-500 text-sm">{selectedMember.memberId} · {selectedMember.phone}</p></div>
                <button onClick={() => setSelectedMember(null)}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div><span className="text-zinc-500">E-mail :</span> {selectedMember.email}</div>
                <div><span className="text-zinc-500">Plan :</span> {state.plans.find(p => p.id === selectedMember.planId)?.name || "Not set"}</div>
                <div><span className="text-zinc-500">Joined :</span> {selectedMember.joinDate}</div>
                <div><span className="text-zinc-500">Expiry :</span> {selectedMember.expiryDate}</div>
                <div><span className="text-zinc-500">Last visit :</span> {selectedMember.lastVisit?.split("T")[0] || "None"}</div>
                <div><span className="text-zinc-500">Balance :</span> {formatETB(selectedMember.balanceDue)}</div>
              </div>
              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <h4 className="font-bold text-sm">Customer category</h4>
                <select value={selectedMember.category || "REGULAR"} onChange={e => changeCategory(selectedMember, e.target.value as CustomerCategory)} data-testid="admin-member-category" className={INPUT}>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabelOf(state, c)}</option>)}
                </select>
                {selectedMember.category === "STUDENT" && (
                  <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Student ID :</span><span>{selectedMember.studentId || "Not provided"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Institution :</span><span>{selectedMember.institution || "Not provided"}</span></div>
                    <button onClick={() => { const verified = !selectedMember.studentVerified; dispatch({ type: "SET_STUDENT_VERIFICATION", payload: { memberId: selectedMember.id, verified, verifiedBy: actor } }); setSelectedMember({ ...selectedMember, studentVerified: verified }); addAudit(dispatch, verified ? "Student status verified" : "Student verification removed", actor, selectedMember.name); toast.success(verified ? "Student status verified" : "Verification removed"); }} className={`w-full py-2.5 rounded-xl font-semibold ${selectedMember.studentVerified ? "bg-zinc-700 text-white" : "bg-lime-400 text-zinc-950"}`}>{selectedMember.studentVerified ? "Remove student verification" : "Verify student status"}</button>
                  </div>
                )}
              </div>
              <div className="border-t border-zinc-800 pt-4 mt-4">
                <h4 className="font-bold text-sm mb-2">Visit history</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {state.visits.filter(v => v.memberId === selectedMember.id).slice(0, 5).map(v => (
                    <div key={v.id} className="text-xs text-zinc-400 flex justify-between"><span>{new Date(v.timestamp).toLocaleDateString("en-US")} · {v.accessStatus === "allowed" ? "Access allowed" : v.accessStatus === "override" ? "Override" : "Denied"}</span><span>by {v.checkedInBy}</span></div>
                  ))}
                  {state.visits.filter(v => v.memberId === selectedMember.id).length === 0 && <p className="text-xs text-zinc-600">No visits recorded</p>}
                </div>
              </div>
              <div className="border-t border-zinc-800 pt-4 mt-4">
                <h4 className="font-bold text-sm mb-2">Payment history</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {state.payments.filter(p => p.memberId === selectedMember.id).map(p => (
                    <div key={p.id} className="text-xs text-zinc-400 flex justify-between"><span>{p.date} · {METHOD_LABELS[p.method] || p.method}</span><span className="text-lime-400">{formatETB(p.amount)}</span></div>
                  ))}
                  {state.payments.filter(p => p.memberId === selectedMember.id).length === 0 && <p className="text-xs text-zinc-600">No payments recorded</p>}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FinancesView() {
  const { state, dispatch } = useGym();
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expForm, setExpForm] = useState({ category: "rent" as Expense["category"], amount: 0, description: "" });

  const addExpense = () => {
    if (!expForm.description || expForm.amount <= 0) { toast.error("Enter a description and a valid amount"); return; }
    const expense: Expense = { id: generateId("e"), category: expForm.category, amount: expForm.amount, date: new Date().toISOString().split("T")[0], description: expForm.description };
    dispatch({ type: "ADD_EXPENSE", payload: expense });
    addAudit(dispatch, "Expense added", state.currentUser?.name || "Owner", `${expForm.description} · ${formatETB(expForm.amount)}`);
    toast.success("Expense saved");
    setShowExpenseForm(false);
    setExpForm({ category: "rent", amount: 0, description: "" });
  };

  const totalRevenue = state.payments.reduce((a, p) => a + p.amount, 0);
  const totalExpenses = state.expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={CARD}><div className="text-sm text-zinc-500 mb-1">Total revenue</div><div className="text-2xl font-black text-lime-400">{formatETB(totalRevenue)}</div></div>
        <div className={CARD}><div className="text-sm text-zinc-500 mb-1">Total expenses</div><div className="text-2xl font-black text-red-400">{formatETB(totalExpenses)}</div></div>
        <div className={CARD}><div className="text-sm text-zinc-500 mb-1">Net balance</div><div className={`text-2xl font-black ${totalRevenue - totalExpenses >= 0 ? "text-lime-400" : "text-red-400"}`}>{formatETB(totalRevenue - totalExpenses)}</div></div>
      </div>
      <h3 className="font-bold text-lg">Payment ledger</h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50"><tr><th className={TH}>Date</th><th className={TH}>Member</th><th className={TH}>Category</th><th className={TH}>Method</th><th className={TH}>Type</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>
            {state.payments.slice().reverse().map(p => {
              const m = state.members.find(mm => mm.id === p.memberId);
              return (
                <tr key={p.id} className="border-t border-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-400">{p.date}</td>
                  <td className="px-4 py-3">{m?.name || "Unknown"}</td>
                  <td className="px-4 py-3 text-xs">{m ? categoryLabelOf(state, m.category || "REGULAR") : "—"}</td>
                  <td className="px-4 py-3">{METHOD_LABELS[p.method] || p.method}</td>
                  <td className="px-4 py-3 text-zinc-400">{PAYMENT_TYPE_LABELS[p.type] || p.type}</td>
                  <td className="px-4 py-3 text-right text-lime-400 font-semibold">{formatETB(p.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {state.payments.length === 0 && <div className="p-8 text-center text-zinc-500">No payments recorded</div>}
      </div>
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Expenses</h3>
        <button onClick={() => setShowExpenseForm(true)} className="bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-lime-300"><Plus className="w-4 h-4" /> Add expense</button>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50"><tr><th className={TH}>Date</th><th className={TH}>Category</th><th className={TH}>Description</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>
            {state.expenses.slice().reverse().map(e => (
              <tr key={e.id} className="border-t border-zinc-800/50">
                <td className="px-4 py-3 text-zinc-400">{e.date}</td>
                <td className="px-4 py-3"><span className="bg-zinc-800 px-2 py-1 rounded text-xs">{EXPENSE_LABELS[e.category]}</span></td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3 text-right text-red-400 font-semibold">{formatETB(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.expenses.length === 0 && <div className="p-8 text-center text-zinc-500">No expenses recorded</div>}
      </div>
      <AnimatePresence>
        {showExpenseForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowExpenseForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={`${CARD} w-full max-w-md`} onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Add expense</h3>
              <div className="space-y-3">
                <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value as Expense["category"] })} className={INPUT}>
                  {(Object.keys(EXPENSE_LABELS) as Expense["category"][]).map(c => <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>)}
                </select>
                <input type="number" value={expForm.amount || ""} onChange={e => setExpForm({ ...expForm, amount: Number(e.target.value) })} placeholder="Amount (Br)" className={INPUT} />
                <input value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} placeholder="Description" className={INPUT} />
                <button onClick={addExpense} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300">Save expense</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}