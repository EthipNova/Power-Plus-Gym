import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { useGym, formatETB } from "../context/GymContext";
import type { Expense } from "../types";
import { toast } from "sonner";
import { useDashboardStats } from "../hooks/use-dashboard-stats";
import { useCustomers } from "../hooks/use-customers";
import { usePayments } from "../hooks/use-payments";
import { useExpenses } from "../hooks/use-expenses";
import { createExpense } from "../services/expenses";
import type { CustomerRecord } from "../services/customers";

const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";
const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const TH = "text-left px-4 py-3";
const STATUS_LABELS: Record<string, string> = { active: "Active", expiring: "Expiring soon", expired: "Expired", inactive: "Inactive", blocked: "Blocked" };
const STATUS_COLORS: Record<string, string> = { active: "bg-lime-400/20 text-lime-400", expiring: "bg-yellow-400/20 text-yellow-400", expired: "bg-red-400/20 text-red-400", inactive: "bg-zinc-400/20 text-zinc-400", blocked: "bg-purple-400/20 text-purple-400" };
const EXPENSE_LABELS: Record<Expense["category"], string> = { rent: "Rent", utilities: "Utilities", equipment: "Equipment", salaries: "Salaries", maintenance: "Maintenance", other: "Other" };

export function CustomersView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const { customers, memberships, plans, total, page, pageSize, isLoading, error, refresh, setPage } = useCustomers(search, statusFilter);
  const selectedMembership = selectedCustomer ? memberships.find(membership => membership.customer_id === selectedCustomer.id) : undefined;
  const selectedPlan = selectedMembership?.plan_id ? plans.find(plan => plan.id === selectedMembership.plan_id) : undefined;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="w-5 h-5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone or member ID..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none">
          <option value="all">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {error && <div className="flex items-center justify-between gap-4 border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"><span>{error}</span><button onClick={() => void refresh()} className="font-semibold text-red-300 hover:text-white">Retry</button></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50">
              <tr><th className={TH}>Member</th><th className={TH}>Member ID</th><th className={TH}>Category</th><th className={TH}>Plan</th><th className={TH}>Status</th><th className={TH}>Expiry</th><th className={TH}>Actions</th></tr>
            </thead>
            <tbody>
              {customers.map(customer => {
                const membership = memberships.find(item => item.customer_id === customer.id);
                const plan = membership?.plan_id ? plans.find(item => item.id === membership.plan_id) : undefined;
                const name = `${customer.first_name} ${customer.last_name}`.trim();
                const status = customer.status.toUpperCase();
                return (
                  <tr key={customer.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3"><div className="font-semibold">{name}</div><div className="text-zinc-500 text-xs">{customer.phone || "No phone"}</div></td>
                    <td className="px-4 py-3 font-mono text-xs">{customer.customer_code}</td>
                    <td className="px-4 py-3 text-zinc-500">—</td>
                    <td className="px-4 py-3">{plan?.name || "Not set"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status.toLowerCase()] || "bg-zinc-400/20 text-zinc-400"}`}>{STATUS_LABELS[status.toLowerCase()] || status}</span></td>
                    <td className="px-4 py-3 text-zinc-400">{membership?.end_date || "—"}</td>
                    <td className="px-4 py-3"><button onClick={() => setSelectedCustomer(customer)} className="text-lime-400 hover:text-lime-300 text-xs font-semibold">Details</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-8 text-center text-zinc-500">Loading customers...</div>}
        {!isLoading && !error && customers.length === 0 && <div className="p-8 text-center text-zinc-500">No customers found</div>}
      </div>
      {!isLoading && totalPages > 1 && <div className="flex items-center justify-between text-sm text-zinc-400"><span>Page {page + 1} of {totalPages}</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Next</button></div></div>}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedCustomer(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-xl font-bold">{selectedCustomer.first_name} {selectedCustomer.last_name}</h3><p className="text-zinc-500 text-sm">{selectedCustomer.customer_code} · {selectedCustomer.phone || "No phone"}</p></div>
                <button onClick={() => setSelectedCustomer(null)}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div><span className="text-zinc-500">E-mail :</span> {selectedCustomer.email || "—"}</div>
                <div><span className="text-zinc-500">Status :</span> {selectedCustomer.status}</div>
                <div><span className="text-zinc-500">Joined :</span> {selectedCustomer.join_date || "—"}</div>
                <div><span className="text-zinc-500">National ID :</span> {selectedCustomer.national_id || "—"}</div>
                <div><span className="text-zinc-500">Date of birth :</span> {selectedCustomer.date_of_birth || "—"}</div>
                <div><span className="text-zinc-500">Gender :</span> {selectedCustomer.gender || "—"}</div>
                <div><span className="text-zinc-500">Address :</span> {selectedCustomer.address || "—"}</div>
                <div><span className="text-zinc-500">Plan :</span> {selectedPlan?.name || "Not set"}</div>
                <div><span className="text-zinc-500">Membership status :</span> {selectedMembership?.status || "—"}</div>
                <div><span className="text-zinc-500">Membership start :</span> {selectedMembership?.start_date || "—"}</div>
                <div><span className="text-zinc-500">Membership end :</span> {selectedMembership?.end_date || "—"}</div>
              </div>
              {selectedCustomer.notes && <div className="border-t border-zinc-800 pt-4 text-sm"><span className="text-zinc-500">Notes :</span> {selectedCustomer.notes}</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FinancesView() {
  const { state } = useGym();
  const { stats, isLoading, error, refresh } = useDashboardStats();
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const paymentLedger = usePayments(paymentSearch, paymentStatus, paymentMethod);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("all");
  const expenseLedger = useExpenses(expenseSearch, expenseCategory);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expForm, setExpForm] = useState({ category: "rent" as Expense["category"], amount: 0, description: "", expenseDate: new Date().toISOString().slice(0, 10) });

  const addExpense = async () => {
    if (!expForm.description || expForm.amount <= 0) { toast.error("Enter a description and a valid amount"); return; }
    if (!state.currentUser?.id) { toast.error("You must be signed in to record an expense"); return; }
    try {
      await createExpense({ category: expForm.category, amount: expForm.amount, expenseDate: expForm.expenseDate, note: expForm.description, recordedBy: state.currentUser.id });
      await expenseLedger.refresh();
      toast.success("Expense saved");
      setShowExpenseForm(false);
      setExpForm({ category: "rent", amount: 0, description: "", expenseDate: new Date().toISOString().slice(0, 10) });
    } catch (cause) {
      console.error("Unable to save expense", cause);
      toast.error(cause instanceof Error ? cause.message : "Unable to save expense.");
    }
  };

  const totalRevenue = stats?.totalRevenue ?? 0;
  const totalExpenses = expenseLedger.totalAmount;
  const netResult = totalRevenue - totalExpenses;
  const displayValue = (value: string) => isLoading || expenseLedger.isLoading ? "..." : error || expenseLedger.error ? "—" : value;
  const paymentPages = Math.ceil(paymentLedger.total / paymentLedger.pageSize);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <button onClick={() => void refresh()} className="font-semibold text-red-300 hover:text-white">Retry</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={CARD}><div className="text-sm text-zinc-500 mb-1">Total revenue</div><div className="text-2xl font-black text-lime-400">{displayValue(formatETB(totalRevenue))}</div></div>
        <div className={CARD}><div className="text-sm text-zinc-500 mb-1">Total expenses</div><div className="text-2xl font-black text-red-400">{displayValue(formatETB(totalExpenses))}</div></div>
        <div className={CARD}><div className="text-sm text-zinc-500 mb-1">Net balance</div><div className={`text-2xl font-black ${netResult >= 0 ? "text-lime-400" : "text-red-400"}`}>{displayValue(formatETB(netResult))}</div></div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-bold text-lg">Payment ledger</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} placeholder="Search customer or reference" className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="all">All statuses</option><option value="PAID">PAID</option><option value="PENDING">PENDING</option><option value="FAILED">FAILED</option><option value="REFUNDED">REFUNDED</option><option value="VOID">VOID</option>
          </select>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="all">All methods</option><option value="CASH">CASH</option><option value="ONLINE_CARD">ONLINE_CARD</option><option value="OTHER">OTHER</option>
          </select>
        </div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        {paymentLedger.error && <div className="flex items-center justify-between gap-4 border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"><span>{paymentLedger.error}</span><button onClick={() => void paymentLedger.refresh()} className="font-semibold text-red-300 hover:text-white">Retry</button></div>}
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50"><tr><th className={TH}>Date</th><th className={TH}>Member</th><th className={TH}>Customer code</th><th className={TH}>Plan</th><th className={TH}>Method</th><th className={TH}>Status</th><th className={TH}>Reference</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>
            {paymentLedger.payments.map(p => {
              const date = p.paid_at || p.created_at;
              return (
                <tr key={p.id} className="border-t border-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-400">{date.slice(0, 10)}</td>
                  <td className="px-4 py-3">{p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : "Unknown"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.customer?.customer_code || "—"}</td>
                  <td className="px-4 py-3">{p.planName || "—"}</td>
                  <td className="px-4 py-3">{p.payment_method || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.payment_status || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.transaction_reference || "—"}</td>
                  <td className="px-4 py-3 text-right text-lime-400 font-semibold">{formatETB(Number(p.amount) || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {paymentLedger.isLoading && <div className="p-8 text-center text-zinc-500">Loading payments...</div>}
        {!paymentLedger.isLoading && !paymentLedger.error && paymentLedger.payments.length === 0 && <div className="p-8 text-center text-zinc-500">No payments found</div>}
      </div>
      {!paymentLedger.isLoading && paymentPages > 1 && <div className="flex items-center justify-between text-sm text-zinc-400"><span>Page {paymentLedger.page + 1} of {paymentPages}</span><div className="flex gap-2"><button disabled={paymentLedger.page === 0} onClick={() => paymentLedger.setPage(paymentLedger.page - 1)} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Previous</button><button disabled={paymentLedger.page >= paymentPages - 1} onClick={() => paymentLedger.setPage(paymentLedger.page + 1)} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Next</button></div></div>}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Expenses</h3>
        <button onClick={() => setShowExpenseForm(true)} className="bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-lime-300"><Plus className="w-4 h-4" /> Add expense</button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} placeholder="Search category or note" className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
        <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="all">All categories</option>
          {(Object.keys(EXPENSE_LABELS) as Expense["category"][]).map(category => <option key={category} value={category}>{EXPENSE_LABELS[category]}</option>)}
        </select>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        {expenseLedger.error && <div className="flex items-center justify-between gap-4 border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"><span>{expenseLedger.error}</span><button onClick={() => void expenseLedger.refresh()} className="font-semibold text-red-300 hover:text-white">Retry</button></div>}
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50"><tr><th className={TH}>Date</th><th className={TH}>Category</th><th className={TH}>Note</th><th className={TH}>Recorded by</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>
            {expenseLedger.expenses.map(e => (
              <tr key={e.id} className="border-t border-zinc-800/50">
                <td className="px-4 py-3 text-zinc-400">{e.expense_date}</td>
                <td className="px-4 py-3"><span className="bg-zinc-800 px-2 py-1 rounded text-xs">{EXPENSE_LABELS[e.category as Expense["category"]] || e.category}</span></td>
                <td className="px-4 py-3">{e.note || "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{e.recorded_by || "—"}</td>
                <td className="px-4 py-3 text-right text-red-400 font-semibold">{formatETB(Number(e.amount) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenseLedger.isLoading && <div className="p-8 text-center text-zinc-500">Loading expenses...</div>}
        {!expenseLedger.isLoading && !expenseLedger.error && expenseLedger.expenses.length === 0 && <div className="p-8 text-center text-zinc-500">No expenses found</div>}
      </div>
      {!expenseLedger.isLoading && Math.ceil(expenseLedger.total / expenseLedger.pageSize) > 1 && <div className="flex items-center justify-between text-sm text-zinc-400"><span>Page {expenseLedger.page + 1} of {Math.ceil(expenseLedger.total / expenseLedger.pageSize)}</span><div className="flex gap-2"><button disabled={expenseLedger.page === 0} onClick={() => expenseLedger.setPage(expenseLedger.page - 1)} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Previous</button><button disabled={expenseLedger.page >= Math.ceil(expenseLedger.total / expenseLedger.pageSize) - 1} onClick={() => expenseLedger.setPage(expenseLedger.page + 1)} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Next</button></div></div>}
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
                <input type="date" value={expForm.expenseDate} onChange={e => setExpForm({ ...expForm, expenseDate: e.target.value })} className={INPUT} />
                <input value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} placeholder="Description" className={INPUT} />
                <button onClick={() => void addExpense()} disabled={expenseLedger.isLoading} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300 disabled:opacity-60">Save expense</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}