import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Coins, TrendUp, Receipt, Gear, Plus, X, MagnifyingGlass, User, ShieldCheck, Drop } from "@phosphor-icons/react";
import LockersManagement from "./LockersManagement";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useGym, useT, formatETB, addAudit, computeMemberStatus, categoryLabelOf, computeSteamStatus } from "../context/GymContext";
import { ALL_CATEGORIES } from "../constants";
import type { CustomerCategory } from "../types";
import { toast } from "sonner";
import { CategoriesView } from "./CategoryManagement";
import { PlansView } from "./PlansView";
import { CustomersView, FinancesView } from "./AdminCustomers";
import { ReportsView } from "./AdminReports";

const TABS = ["dashboard", "customers", "categories", "plans", "finances", "reports", "lockers", "settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  dashboard: "admin.tab.dashboard",
  customers: "admin.tab.customers",
  categories: "admin.tab.categories",
  plans: "admin.tab.plans",
  finances: "admin.tab.finances",
  reports: "admin.tab.reports",
  lockers: "admin.tab.lockers",
  settings: "admin.tab.settings",
};

export const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";
export const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
export const CHART_TOOLTIP = { background: "#18181b", border: "1px solid #27272a", borderRadius: 8 };
export const METHOD_LABELS: Record<string, string> = { telebirr: "Telebirr", cbe_birr: "CBE Birr", cash: "Cash", card: "Card" };

export default function AdminPortal() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <ShieldCheck weight="fill" className="w-6 h-6 text-lime-400" />
          <h1 className="text-2xl font-black uppercase tracking-tight">{t("admin.title")}</h1>
        </div>
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {TABS.map(key => (
            <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === key ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{t(TAB_LABEL[key])}</button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {tab === "dashboard" && <DashboardView />}
            {tab === "customers" && <CustomersView />}
            {tab === "categories" && <CategoriesView />}
            {tab === "plans" && <PlansView />}
            {tab === "finances" && <FinancesView />}
            {tab === "reports" && <ReportsView />}
            {tab === "lockers" && <LockersManagement />}
            {tab === "settings" && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DashboardView() {
  const { state } = useGym();
  const totalRevenue = state.payments.reduce((a, p) => a + p.amount, 0);
  const totalExpenses = state.expenses.reduce((a, e) => a + e.amount, 0);
  const netResult = totalRevenue - totalExpenses;
  const activeMembers = state.members.filter(m => computeMemberStatus(m, state.settings) === "active").length;
  const expiringMembers = state.members.filter(m => computeMemberStatus(m, state.settings) === "expiring").length;
  const expiredMembers = state.members.filter(m => computeMemberStatus(m, state.settings) === "expired").length;
  const steamRevenue = state.payments.filter(p => p.type === "steam").reduce((a, p) => a + p.amount, 0);
  const activeSteam = state.steamAccess.filter(s => computeSteamStatus(s, state.settings) !== "Expired").length;

  const monthlyData = useMemo(() => {
    const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    return months.map((m, i) => ({ name: m, revenue: 45000 + i * 8000 + Math.floor(Math.random() * 10000), expenses: 38000 + Math.floor(Math.random() * 5000) }));
  }, []);

  const kpis = [
    { label: "Total revenue", value: formatETB(totalRevenue), icon: Coins, color: "text-lime-400" },
    { label: "Total expenses", value: formatETB(totalExpenses), icon: Receipt, color: "text-red-400" },
    { label: "Net result", value: formatETB(netResult), icon: TrendUp, color: netResult >= 0 ? "text-lime-400" : "text-red-400" },
    { label: "Active members", value: String(activeMembers), icon: Users, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={CARD}>
            <kpi.icon weight="fill" className={`w-8 h-8 ${kpi.color} mb-3`} />
            <div className="text-2xl font-black">{kpi.value}</div>
            <div className="text-sm text-zinc-500">{kpi.label}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${CARD} text-center`}><div className="text-3xl font-black text-lime-400">{activeMembers}</div><div className="text-sm text-zinc-400 mt-1">Active</div></div>
        <div className={`${CARD} text-center`}><div className="text-3xl font-black text-yellow-400">{expiringMembers}</div><div className="text-sm text-zinc-400 mt-1">Expiring soon</div></div>
        <div className={`${CARD} text-center`}><div className="text-3xl font-black text-red-400">{expiredMembers}</div><div className="text-sm text-zinc-400 mt-1">Expired</div></div>
      </div>
      {state.settings.steamEnabled && (
        <div className={CARD}>
          <h3 className="font-bold mb-4 flex items-center gap-2"><Drop weight="fill" className="w-5 h-5 text-cyan-400" /> Steam module</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-2xl p-4"><div className="text-2xl font-black text-cyan-400">{activeSteam}</div><div className="text-xs text-zinc-500">Active Steam passes</div></div>
            <div className="bg-zinc-800/50 rounded-2xl p-4"><div className="text-2xl font-black text-lime-400">{formatETB(steamRevenue)}</div><div className="text-xs text-zinc-500">Steam revenue</div></div>
            <div className="bg-zinc-800/50 rounded-2xl p-4"><div className="text-2xl font-black text-white">{state.steamUsage.length}</div><div className="text-xs text-zinc-500">Steam entries logged</div></div>
          </div>
        </div>
      )}
      <div className={CARD}>
        <h3 className="font-bold mb-4">Member breakdown by customer category</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ALL_CATEGORIES.map(cat => {
            const list = state.members.filter(m => (m.category || "REGULAR") === cat);
            const revenue = state.payments.filter(p => list.some(m => m.id === p.memberId)).reduce((a, p) => a + p.amount, 0);
            return (
              <div key={cat} className="bg-zinc-800/50 rounded-2xl p-4">
                <div className="text-sm font-semibold">{categoryLabelOf(state, cat)}</div>
                <div className="text-2xl font-black text-lime-400">{list.length}</div>
                <div className="text-xs text-zinc-500">{formatETB(revenue)} in revenue</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-4">Revenue vs expenses (monthly)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Bar dataKey="revenue" fill="#a3e635" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SettingsView() {
  const { state, dispatch } = useGym();
  const [settings, setSettings] = useState({ ...state.settings });

  const saveSettings = () => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings });
    addAudit(dispatch, "Settings updated", state.currentUser?.name || "Owner", "Gym settings changed");
    toast.success("Settings saved");
  };

  const fields: { key: keyof typeof settings; label: string; type?: string }[] = [
    { key: "gymName", label: "Gym name" },
    { key: "tagline", label: "Tagline" },
    { key: "email", label: "E-mail" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "inactivityThresholdDays", label: "Inactivity threshold (days)", type: "number" },
  ];

  return (
    <div className="space-y-6">
      <div className={CARD}>
        <h3 className="font-bold mb-4 flex items-center gap-2"><Gear className="w-5 h-5 text-lime-400" /> Gym information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={String(f.key)}>
              <label className="text-xs text-zinc-500 block mb-1">{f.label}</label>
              <input
                type={f.type || "text"}
                value={String(settings[f.key] ?? "")}
                onChange={e => setSettings({ ...settings, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                className={INPUT}
              />
            </div>
          ))}
        </div>
        <button onClick={saveSettings} className="mt-4 bg-lime-400 text-zinc-950 px-6 py-2.5 rounded-xl font-bold hover:bg-lime-300">Save settings</button>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-4 flex items-center gap-2"><Drop weight="fill" className="w-5 h-5 text-cyan-400" /> Steam configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.steamEnabled} onChange={e => setSettings({ ...settings, steamEnabled: e.target.checked })} className="w-5 h-5 accent-cyan-400" />
            <span className="text-sm">Enable the Steam module</span>
          </label>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Sales model</label>
            <select value={settings.steamModel} onChange={e => setSettings({ ...settings, steamModel: e.target.value as typeof settings.steamModel })} className={INPUT}>
              <option value="package">Package only</option>
              <option value="per_visit">Single session</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div><label className="text-xs text-zinc-500 block mb-1">Package price (ETB)</label><input type="number" value={settings.steamPackagePrice} onChange={e => setSettings({ ...settings, steamPackagePrice: Number(e.target.value) })} className={INPUT} /></div>
          <div><label className="text-xs text-zinc-500 block mb-1">Sessions per package</label><input type="number" value={settings.steamPackageVisits} onChange={e => setSettings({ ...settings, steamPackageVisits: Number(e.target.value) })} className={INPUT} /></div>
          <div><label className="text-xs text-zinc-500 block mb-1">Package validity (days)</label><input type="number" value={settings.steamPackageDays} onChange={e => setSettings({ ...settings, steamPackageDays: Number(e.target.value) })} className={INPUT} /></div>
          <div><label className="text-xs text-zinc-500 block mb-1">Single session price (ETB)</label><input type="number" value={settings.steamPerVisitPrice} onChange={e => setSettings({ ...settings, steamPerVisitPrice: Number(e.target.value) })} className={INPUT} /></div>
          <div><label className="text-xs text-zinc-500 block mb-1">Expiry alert (days)</label><input type="number" value={settings.steamExpiringSoonDays} onChange={e => setSettings({ ...settings, steamExpiringSoonDays: Number(e.target.value) })} className={INPUT} /></div>
        </div>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-4">Staff accounts</h3>
        <div className="space-y-3">
          {state.staff.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3"><User className="w-5 h-5 text-zinc-400" /><div><div className="font-semibold text-sm">{s.name}</div><div className="text-xs text-zinc-500">{s.email}</div></div></div>
              <span className={`text-xs px-2 py-1 rounded-full ${s.role === "owner" ? "bg-lime-400/20 text-lime-400" : "bg-blue-400/20 text-blue-400"}`}>{s.role === "owner" ? "Owner" : s.role === "staff" ? "Reception" : s.role === "trainer" ? "Coach" : "Member"}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-4">Audit log</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {state.auditLogs.slice().reverse().map(a => (
            <div key={a.id} className="text-sm border-l-2 border-zinc-700 pl-3 py-1">
              <div className="font-semibold">{a.action}</div>
              <div className="text-zinc-500 text-xs">{a.details} · {a.actor} on {new Date(a.timestamp).toLocaleString("en-US")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}