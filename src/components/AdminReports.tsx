import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useGym, formatETB, dayName } from "../context/GymContext";
import { WEEK_DAYS } from "../constants";
import { useReportCategories } from "../hooks/use-report-categories";

const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const TH = "text-left px-4 py-3";
const CHART_TOOLTIP = { background: "#18181b", border: "1px solid #27272a", borderRadius: 8 };
const COLORS = ["#a3e635", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const TREND = [{ m: "Feb", net: 8000 }, { m: "Mar", net: 12000 }, { m: "Apr", net: 9000 }, { m: "May", net: 15000 }, { m: "Jun", net: 14000 }, { m: "Jul", net: 18000 }];

export function ReportsView() {
  const { state } = useGym();
  const [planFilter, setPlanFilter] = useState("ALL");
  const { rows, isLoading, error, refresh } = useReportCategories();
  const filteredRows = planFilter === "ALL" ? rows : rows.filter(row => row.planName === planFilter);
  const planDist = filteredRows.map(row => ({ name: row.planName, value: row.members }));

  const attendanceData = WEEK_DAYS.map(day => ({
    day: day.slice(0, 3),
    visits: state.visits.filter(v => dayName(new Date(v.timestamp)) === day).length,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Reports by customer category</h2>
          <p className="text-sm text-zinc-500">Cross-analysis of headcount, revenue and check-ins.</p>
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} data-testid="report-category-filter" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none">
          <option value="ALL">All categories</option>
          {rows.map(row => <option key={row.planName} value={row.planName}>{row.planName}</option>)}
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        {error && <div className="flex items-center justify-between gap-4 border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"><span>{error}</span><button onClick={() => void refresh()} className="font-semibold text-red-300 hover:text-white">Retry</button></div>}
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
            {!isLoading && !error && filteredRows.map(r => (
              <tr key={r.planName} className="border-t border-zinc-800/50">
                <td className="px-4 py-3 font-semibold">{r.planName}</td>
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
        {isLoading && <div className="p-8 text-center text-zinc-500">Loading customer categories...</div>}
        {!isLoading && !error && filteredRows.length === 0 && <div className="p-8 text-center text-zinc-500">No data for this filter</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={CARD}>
          <h3 className="font-bold mb-4">Breakdown by plan</h3>
          {isLoading ? <p className="text-sm text-zinc-500">Loading customer categories...</p> : error ? <p className="text-sm text-red-300">Unable to load customer categories.</p> : planDist.length === 0 ? <p className="text-sm text-zinc-500">No members in this scope</p> : (
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