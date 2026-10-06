import { useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lockers,
  Key,
  KeyReturn,
  Plus,
  MagnifyingGlass,
  Check,
  Warning,
  XCircle,
  X,
  ChartBar,
  ArrowsClockwise,
  User,
  Clock,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  useGym,
  useT,
  lockerStats,
  activeAssignmentOf,
  issueLocker,
  returnLocker,
  reportLostKey,
  generateId,
} from "../context/GymContext";
import type { Locker, LockerSection, LockerStatus } from "../types";

const SECTIONS: LockerSection[] = ["Men", "Women", "VIP", "General"];

const STATUS_STYLE: Record<LockerStatus, { tile: string; dot: string; text: string; chip: string }> = {
  AVAILABLE: {
    tile: "border-emerald-400/40 bg-emerald-400/5 hover:bg-emerald-400/10",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    chip: "bg-emerald-400/15 text-emerald-400",
  },
  IN_USE: {
    tile: "border-amber-400/40 bg-amber-400/5 hover:bg-amber-400/10",
    dot: "bg-amber-400",
    text: "text-amber-400",
    chip: "bg-amber-400/15 text-amber-400",
  },
  OUT_OF_SERVICE: {
    tile: "border-red-400/40 bg-red-400/5 hover:bg-red-400/10",
    dot: "bg-red-400",
    text: "text-red-400",
    chip: "bg-red-400/15 text-red-400",
  },
};

const inputClass =
  "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400/60 transition-colors";
const labelClass = "text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block";

export default function LockersManagement() {
  const { state, dispatch } = useGym();
  const t = useT();
  const actor = state.currentUser?.name ?? "Reception";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LockerStatus>("ALL");
  const [sectionFilter, setSectionFilter] = useState<"ALL" | LockerSection>("ALL");
  const [selected, setSelected] = useState<Locker | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const stats = useMemo(() => lockerStats(state), [state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.lockers
      .filter(l => statusFilter === "ALL" || l.status === statusFilter)
      .filter(l => sectionFilter === "ALL" || l.section === sectionFilter)
      .filter(l => {
        if (!q) return true;
        const occupant = activeAssignmentOf(state, l.id)?.memberName ?? "";
        return `${l.number} ${l.keyTag} ${l.section} ${occupant}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.number.localeCompare(b.number));
  }, [state, search, statusFilter, sectionFilter]);

  const history = useMemo(
    () => state.lockerAssignments.slice().sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1)).slice(0, 8),
    [state.lockerAssignments],
  );

  const statCards: { key: string; value: string; icon: ReactNode; accent: string }[] = [
    { key: "locker.total", value: String(stats.total), icon: <Lockers className="w-5 h-5" />, accent: "text-lime-400" },
    { key: "locker.utilization", value: `${stats.utilization}%`, icon: <ChartBar className="w-5 h-5" />, accent: "text-amber-400" },
    { key: "locker.unreturned", value: String(stats.unreturned), icon: <ArrowsClockwise className="w-5 h-5" />, accent: "text-blue-400" },
    { key: "locker.lostKeys", value: String(stats.lostKeys), icon: <Key className="w-5 h-5" />, accent: "text-red-400" },
    { key: "locker.avgHold", value: t("locker.days", { n: stats.avgHoldDays }), icon: <Clock className="w-5 h-5" />, accent: "text-zinc-300" },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-lime-400/15 rounded-2xl flex items-center justify-center">
            <Lockers weight="fill" className="w-6 h-6 text-lime-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">{t("locker.title")}</h2>
            <p className="text-sm text-zinc-500">
              {t("locker.activeAssignments")}: {stats.inUse} · {t("locker.unassigned")}: {stats.available}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-lime-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors active:scale-[0.97] flex items-center gap-2"
        >
          <Plus weight="bold" className="w-4 h-4" /> {t("locker.add")}
        </button>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map(card => (
          <div key={card.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className={`flex items-center gap-2 mb-2 ${card.accent}`}>
              {card.icon}
              <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t(card.key)}</span>
            </div>
            <div className="text-2xl font-black text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("locker.searchPlaceholder")}
            className={`${inputClass} pl-10 py-2.5`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as "ALL" | LockerStatus)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-lime-400/60"
        >
          <option value="ALL">{t("locker.allStatuses")}</option>
          {(["AVAILABLE", "IN_USE", "OUT_OF_SERVICE"] as LockerStatus[]).map(s => (
            <option key={s} value={s}>
              {t(`locker.status.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={sectionFilter}
          onChange={e => setSectionFilter(e.target.value as "ALL" | LockerSection)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-lime-400/60"
        >
          <option value="ALL">{t("locker.allSections")}</option>
          {SECTIONS.map(s => (
            <option key={s} value={s}>
              {t(`locker.section.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-500">
          {t("locker.noLockers")}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {filtered.map(locker => {
            const assignment = activeAssignmentOf(state, locker.id);
            const style = STATUS_STYLE[locker.status];
            return (
              <button
                key={locker.id}
                onClick={() => setSelected(locker)}
                className={`text-left border rounded-2xl p-4 transition-colors active:scale-[0.98] ${style.tile}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-black text-lg text-white">{locker.number}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                  <KeyReturn className="w-3.5 h-3.5" /> {locker.keyTag || "—"}
                </div>
                <div className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>{t(`locker.status.${locker.status}`)}</div>
                <div className="mt-2 text-[11px] text-zinc-500 truncate">
                  {assignment ? assignment.memberName : t(`locker.section.${locker.section}`)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Historique */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <ArrowsClockwise className="w-5 h-5 text-lime-400" /> {t("locker.history")}
        </h3>
        {history.length === 0 ? (
          <p className="text-zinc-500 text-sm">{t("locker.noAssignments")}</p>
        ) : (
          <div className="space-y-2">
            {history.map(a => {
              const locker = state.lockers.find(l => l.id === a.lockerId);
              const chip =
                a.status === "active"
                  ? "bg-amber-400/15 text-amber-400"
                  : a.status === "lost"
                    ? "bg-red-400/15 text-red-400"
                    : "bg-emerald-400/15 text-emerald-400";
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {locker?.number ?? "—"} · {a.memberName}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {t("locker.issuedAt")} {new Date(a.assignedAt).toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")}
                      {a.lostKeyFee > 0 ? ` · ${state.settings.currency} ${a.lostKeyFee}` : ""}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${chip}`}>
                    {a.status === "active" ? t("locker.status.IN_USE") : t(`locker.status.${a.status === "lost" ? "OUT_OF_SERVICE" : "AVAILABLE"}`)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && <LockerActionModal locker={selected} onClose={() => setSelected(null)} actor={actor} />}
        {showAdd && <AddLockerModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------- Modal : action sur un casier ---------------------------- */

function LockerActionModal({ locker, onClose, actor }: { locker: Locker; onClose: () => void; actor: string }) {
  const { state, dispatch } = useGym();
  const t = useT();
  const assignment = activeAssignmentOf(state, locker.id);
  const [memberId, setMemberId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("200");

  const run = (fn: () => { ok: boolean; message: string }) => {
    const res = fn();
    if (res.ok) {
      toast.success(res.message);
      onClose();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md"
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
              <Lockers weight="fill" className="w-6 h-6 text-lime-400" /> {locker.number}
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              {t(`locker.section.${locker.section}`)} · {t("locker.keyTag")} {locker.keyTag || "—"}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5 ${STATUS_STYLE[locker.status].chip}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[locker.status].dot}`} />
          {t(`locker.status.${locker.status}`)}
        </div>

        {locker.status === "AVAILABLE" && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t("locker.selectMember")}</label>
              <select value={memberId} onChange={e => setMemberId(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {state.members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.memberId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("locker.dueDateOptional")}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t("common.notes")}</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
            </div>
            <button
              onClick={() => {
                const member = state.members.find(m => m.id === memberId);
                if (!member) {
                  toast.error(t("locker.fillRequired"));
                  return;
                }
                run(() => issueLocker(state, dispatch, locker.id, member, actor, dueDate || null, notes));
              }}
              className="w-full bg-lime-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-lime-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check weight="bold" className="w-4 h-4" /> {t("locker.issue")}
            </button>
          </div>
        )}

        {locker.status === "IN_USE" && assignment && (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-white font-semibold">
                <User className="w-4 h-4 text-lime-400" /> {assignment.memberName}
              </div>
              <div className="text-xs text-zinc-500">
                {t("locker.issuedAt")}: {new Date(assignment.assignedAt).toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")}
              </div>
              <div className="text-xs text-zinc-500">
                {t("locker.issuedBy")}: {assignment.issuedBy}
              </div>
              {assignment.dueDate && (
                <div className="text-xs text-zinc-500">
                  {t("locker.dueDate")}: {new Date(assignment.dueDate).toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")}
                </div>
              )}
            </div>
            <button
              onClick={() => run(() => returnLocker(state, dispatch, locker.id, actor))}
              className="w-full bg-emerald-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-emerald-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <KeyReturn weight="bold" className="w-4 h-4" /> {t("locker.return")}
            </button>
            <div className="border-t border-zinc-800 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-red-400 font-semibold">
                <Warning className="w-4 h-4" /> {t("locker.lostKey")}
              </div>
              <div>
                <label className={labelClass}>{t("locker.lostKeyFee")}</label>
                <input type="number" min={0} value={fee} onChange={e => setFee(e.target.value)} className={inputClass} />
              </div>
              <button
                onClick={() => run(() => reportLostKey(state, dispatch, locker.id, actor, Number(fee) || 0))}
                className="w-full bg-red-400/15 text-red-400 border border-red-400/40 py-3 rounded-xl font-bold hover:bg-red-400/25 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <XCircle weight="bold" className="w-4 h-4" /> {t("locker.lostKey")}
              </button>
            </div>
          </div>
        )}

        {locker.status === "OUT_OF_SERVICE" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-xl p-4">
              <Warning className="w-5 h-5 shrink-0" />
              <span>{t("locker.outOfService")}</span>
            </div>
            <button
              onClick={() => {
                dispatch({ type: "UPDATE_LOCKER", payload: { ...locker, status: "AVAILABLE" } });
                toast.success(t("locker.status.AVAILABLE"));
                onClose();
              }}
              className="w-full bg-zinc-800 border border-zinc-700 py-3 rounded-xl font-bold text-white hover:bg-zinc-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check weight="bold" className="w-4 h-4" /> {t("locker.status.AVAILABLE")}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------- Modal : ajout (unitaire ou en lot) ---------------------------- */

function AddLockerModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useGym();
  const t = useT();
  const [section, setSection] = useState<LockerSection>("Men");
  const [number, setNumber] = useState("");
  const [keyTag, setKeyTag] = useState("");
  const [prefix, setPrefix] = useState("M");
  const [start, setStart] = useState("11");
  const [count, setCount] = useState("5");

  const addSingle = () => {
    if (!number.trim()) {
      toast.error(t("locker.fillRequired"));
      return;
    }
    dispatch({
      type: "ADD_LOCKER",
      payload: {
        id: generateId("lk"),
        number: number.trim(),
        section,
        keyTag: keyTag.trim(),
        status: "AVAILABLE",
        createdAt: new Date().toISOString().split("T")[0],
      },
    });
    toast.success(`${number.trim()} · ${t("locker.status.AVAILABLE")}`);
    onClose();
  };

  const addBulk = () => {
    const n = Math.max(1, Math.min(50, Number(count) || 0));
    const s = Number(start) || 1;
    const p = prefix.trim() || "G";
    const items: Locker[] = Array.from({ length: n }, (_, i) => {
      const num = s + i;
      return {
        id: generateId("lk"),
        number: `${p}-${String(num).padStart(2, "0")}`,
        section,
        keyTag: `K-${p}${num}`,
        status: "AVAILABLE",
        createdAt: new Date().toISOString().split("T")[0],
      };
    });
    dispatch({ type: "ADD_LOCKERS", payload: items });
    toast.success(`${n} · ${t("locker.create")}`);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-2xl font-black uppercase text-white">{t("locker.add")}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="mb-5">
          <label className={labelClass}>{t("locker.section")}</label>
          <div className="grid grid-cols-4 gap-2">
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  section === s ? "bg-lime-400 text-zinc-950 border-lime-400" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-lime-400/40"
                }`}
              >
                {t(`locker.section.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("locker.number")}</label>
              <input value={number} onChange={e => setNumber(e.target.value)} placeholder="M-11" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t("locker.keyTag")}</label>
              <input value={keyTag} onChange={e => setKeyTag(e.target.value)} placeholder="K-111" className={inputClass} />
            </div>
          </div>
          <button
            onClick={addSingle}
            className="w-full bg-lime-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-lime-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check weight="bold" className="w-4 h-4" /> {t("common.save")}
          </button>
        </div>

        <div className="border-t border-zinc-800 pt-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
            <Plus weight="bold" className="w-4 h-4 text-lime-400" /> {t("locker.bulkAdd")}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelClass}>{t("locker.prefix")}</label>
              <input value={prefix} onChange={e => setPrefix(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t("locker.startNumber")}</label>
              <input type="number" value={start} onChange={e => setStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t("locker.count")}</label>
              <input type="number" min={1} max={50} value={count} onChange={e => setCount(e.target.value)} className={inputClass} />
            </div>
          </div>
          <button
            onClick={addBulk}
            className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Plus weight="bold" className="w-4 h-4" /> {t("locker.create")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}