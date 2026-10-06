import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useGym, formatETB, categoryLabelOf, dayName } from "../context/GymContext";
import { ALL_CATEGORIES, WEEK_DAYS } from "../constants";
import type { CustomerCategory } from "../types";

const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const TH = "text-left px-4 py-3";
const CHART_TOOLTIP = { background: "#18181b", border: "1px solid #27272a", borderRadius: 8 };
const COLORS = ["#a3e635", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const TREND = [{ m: "Feb", net: 8000 }, { m: "Mar", net: 12000 }, { m: "Apr", net: 9000 }, { m: "May", net: 15000 }, { m: "Jun", net: 14000 }, { m: "Jul", net: 18000 }];

export function ReportsView() {
  const { state } = useGym();
  const [catFilter, setCatFilter] = useState<CustomerCategory | "ALL">("ALL");
  const scoped = catFilter === "ALL" ? state.members : state.members.filter(m => (m.category || "REGULAR") === catFilter);
  const scopedIds = new Set(scoped.map(m => m.id));

  const planDist = state.plans
    .map(p => ({ name: p.name, value: scoped.filter(m => m.planId === p.id).length }))
    .filter(d => d.value > 0);

  const attendanceData = WEEK_DAYS.map(day => ({
    day: day.slice(0, 3),
    visits: state.visits.filter(v => dayName(new Date(v.timestamp)) === day && (catFilter === "ALL" || scopedIds.has(v.memberId))).length,
  }));

  const rows = ALL_CATEGORIES.map(cat => {
    const list = state.members.filter(m => (m.category || "REGULAR") === cat);
    const ids = new Set(list.map(m => m.id));
    const revenue = state.payments.filter(p => ids.has(p.memberId)).reduce((a, p) => a + p.amount, 0);
    const visits = state.visits.filter(v => ids.has(v.memberId));
    const plan = state.plans.find(p => p.id === list[0]?.planId);
    return {
      cat,
      label: categoryLabelOf(state, cat),
      members: list.length,
      revenue,
      visits: visits.length,
      denied: visits.filter(v => v.accessStatus === "denied").length,
      planName: plan?.name || "—",
      revenuePerMember: list.length ? Math.round(revenue / list.length) : 0,
    };
  }).filter(r => catFilter === "ALL" || r.cat === catFilter);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Reports by customer category</h2>
          <p className="text-sm text-zinc-500">Cross-analysis of headcount, revenue and check-ins.</p>
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value as CustomerCategory | "ALL")} data-testid="report-category-filter" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none">
          <option value="ALL">All categories</option>
          {ALL_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabelOf(state, c)}</option>)}
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className={TH}>Category</th><th className={TH}>Main plan</th>
              <th className="text-right px-4 py-3">Members</th><th className="text-right px-4 py-3">Revenue</th>
              <th className="text-right px-4 py-3">Revenue / member</th><th className="text-right px-4 py-3">Visits</th>
              <th className="text-right px-4 py-3">Denied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.cat} className="border-t border-zinc-800/50">
                <td className="px-4 py-3 font-semibold">{r.label}</td>
                <td className="px-4 py-3 text-zinc-400">{r.planName}</td>
                <td className="px-4 py-3 text-right">{r.members}</td>
                <td className="px-4 py-3 text-right text-lime-400 font-semibold">{formatETB(r.revenue)}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{formatETB(r.revenuePerMember)}</td>
                <td className="px-4 py-3 text-right">{r.visits}</td>
                <td className="px-4 py-3 text-right text-red-400">{r.denied}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-8 text-center text-zinc-500">No data for this filter</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={CARD}>
          <h3 className="font-bold mb-4">Breakdown by plan</h3>
          {planDist.length === 0 ? <p className="text-sm text-zinc-500">No members in this scope</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={planDist} cx="50%" cy="50%" outerRadius={85} dataKey="value">
                  {planDist.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 mt-3">
            {planDist.map((d, i) => (
              <span key={d.name} className="text-xs text-zinc-400 flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {d.name} · {d.value}</span>
            ))}
          </div>
        </div>
        <div className={CARD}>
          <h3 className="font-bold mb-4">Weekly attendance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold mb-4">Net trend (6 months)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={TREND}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="m" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Line type="monotone" dataKey="net" stroke="#a3e635" strokeWidth={2} dot={{ fill: "#a3e635" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}