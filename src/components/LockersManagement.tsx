import { useMemo, useState, useEffect, useCallback, type ReactNode } from "react";
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
  ArrowsClockwise,
  User,
  Clock,
  PencilSimple,
  Calendar,
  IdentificationCard,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  useGym,
  useT,
  lockerStats,
  activeAssignmentOf,
  addAudit,
} from "../context/GymContext";
import {
  fetchLockersAndAssignments,
  createLockerInDatabase,
  updateLockerInDatabase,
  assignLockerInDatabase,
  releaseLockerInDatabase,
  reportLostKeyInDatabase,
  filterRecentAssignments,
} from "../lib/lockerService";
import type { Locker, LockerStatus, LockerAssignment } from "../types";

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
  const [selected, setSelected] = useState<Locker | null>(null);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Sync with Supabase on mount
  const syncWithDatabase = useCallback(async (notify = false) => {
    setIsSyncing(true);
    try {
      const data = await fetchLockersAndAssignments();
      if (data) {
        if (data.lockers.length > 0) {
          dispatch({ type: "SET_LOCKERS", payload: data.lockers });
        }
        if (data.assignments.length > 0) {
          dispatch({ type: "SET_LOCKER_ASSIGNMENTS", payload: data.assignments });
        }
        if (notify) toast.success("Lockers synced with database");
      }
    } catch (err) {
      console.error("Failed to sync lockers:", err);
      if (notify) toast.error("Could not sync with database");
    } finally {
      setIsSyncing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    syncWithDatabase(false);
  }, [syncWithDatabase]);

  const stats = useMemo(() => lockerStats(state), [state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.lockers
      .filter(l => statusFilter === "ALL" || l.status === statusFilter)
      .filter(l => {
        if (!q) return true;
        const assignment = activeAssignmentOf(state, l.id);
        const occupant = assignment?.memberName ?? "";
        const recipient = assignment?.keyRecipient ?? "";
        return `${l.number} ${l.keyTag || ""} ${occupant} ${recipient} ${l.notes || ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [state, search, statusFilter]);

  // Recent assignments: strictly last 7 days by default, or all history if toggled
  const recentAssignments = useMemo(
    () => filterRecentAssignments(state.lockerAssignments, 7),
    [state.lockerAssignments]
  );

  const displayedHistory = useMemo(() => {
    if (showAllHistory) {
      return state.lockerAssignments.slice().sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1));
    }
    return recentAssignments;
  }, [showAllHistory, state.lockerAssignments, recentAssignments]);

  // Clean stat cards: Note that Utilization and Avg. Hold have been removed per requirement!
  const statCards: { key: string; label: string; value: string; icon: ReactNode; accent: string }[] = [
    { key: "total", label: t("locker.total"), value: String(stats.total), icon: <Lockers className="w-5 h-5" />, accent: "text-lime-400" },
    { key: "available", label: t("locker.status.AVAILABLE"), value: String(stats.available), icon: <Check className="w-5 h-5" />, accent: "text-emerald-400" },
    { key: "inUse", label: t("locker.status.IN_USE"), value: String(stats.inUse), icon: <Clock className="w-5 h-5" />, accent: "text-amber-400" },
    { key: "outOfService", label: t("locker.status.OUT_OF_SERVICE"), value: String(stats.outOfService), icon: <Warning className="w-5 h-5" />, accent: "text-red-400" },
    { key: "lostKeys", label: t("locker.lostKeys"), value: String(stats.lostKeys), icon: <Key className="w-5 h-5" />, accent: "text-rose-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-lime-400/15 rounded-2xl flex items-center justify-center">
            <Lockers weight="fill" className="w-6 h-6 text-lime-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">{t("locker.title")}</h2>
            <p className="text-sm text-zinc-500">
              {t("locker.activeAssignments")}: <span className="text-amber-400 font-semibold">{stats.inUse}</span> · {t("locker.status.AVAILABLE")}: <span className="text-emerald-400 font-semibold">{stats.available}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncWithDatabase(true)}
            disabled={isSyncing}
            title={t("locker.sync")}
            className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-3.5 py-2.5 rounded-xl font-medium text-sm hover:text-white hover:bg-zinc-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-4 h-4 ${isSyncing ? "animate-spin text-lime-400" : ""}`} />
            <span className="hidden sm:inline">{t("locker.sync")}</span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-lime-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors active:scale-[0.97] flex items-center gap-2"
          >
            <Plus weight="bold" className="w-4 h-4" /> {t("locker.add")}
          </button>
        </div>
      </div>

      {/* Summary Cards: Utilization and Avg. Hold completely removed */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(card => (
          <div key={card.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className={`flex items-center gap-2 mb-2 ${card.accent}`}>
              {card.icon}
              <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{card.label}</span>
            </div>
            <div className="text-2xl font-black text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
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
      </div>

      {/* Lockers Grid */}
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
              <div
                key={locker.id}
                onClick={() => setSelected(locker)}
                className={`relative group text-left border rounded-2xl p-4 transition-all cursor-pointer hover:border-zinc-500/50 ${style.tile}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-lg text-white">{locker.number}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingLocker(locker);
                      }}
                      title={t("locker.edit")}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                    >
                      <PencilSimple className="w-3.5 h-3.5" />
                    </button>
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
                  <KeyReturn className="w-3.5 h-3.5" /> {locker.keyTag || "—"}
                </div>

                <div className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
                  {t(`locker.status.${locker.status}`)}
                </div>

                {assignment ? (
                  <div className="mt-2 pt-2 border-t border-zinc-800/80">
                    <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                      <User className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{assignment.memberName}</span>
                    </div>
                    {assignment.keyRecipient && assignment.keyRecipient !== assignment.memberName && (
                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                        Key: {assignment.keyRecipient}
                      </div>
                    )}
                  </div>
                ) : locker.notes ? (
                  <div className="mt-2 text-[10px] text-zinc-500 truncate" title={locker.notes}>
                    {locker.notes}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Assignments (Last 7 Days) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowsClockwise className="w-5 h-5 text-lime-400" />
              {showAllHistory ? t("locker.allAssignments") : t("locker.recentAssignments")}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {showAllHistory
                ? `Showing complete database history (${state.lockerAssignments.length} total records)`
                : `Showing assignments from the last 7 days (${recentAssignments.length} records). Database history is permanently preserved.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAllHistory(!showAllHistory)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              {showAllHistory ? "Show Recent (≤ 7 Days)" : `View All History (${state.lockerAssignments.length})`}
            </button>
          </div>
        </div>

        {displayedHistory.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            {showAllHistory ? "No assignments recorded yet in database." : t("locker.noAssignments")}
          </div>
        ) : (
          <div className="space-y-2">
            {displayedHistory.map(a => {
              const locker = state.lockers.find(l => l.id === a.lockerId);
              const chip =
                a.status === "active"
                  ? "bg-amber-400/15 text-amber-400"
                  : a.status === "lost"
                    ? "bg-red-400/15 text-red-400"
                    : "bg-emerald-400/15 text-emerald-400";

              const assignDate = new Date(a.assignedAt);
              const daysAgo = Math.floor((Date.now() - assignDate.getTime()) / (1000 * 60 * 60 * 24));
              const relativeText = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;

              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-4 py-3 hover:bg-zinc-800/60 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-lime-400 font-bold">{locker?.number ?? "Locker"}</span>
                      <span>·</span>
                      <span className="truncate">{a.memberName}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-1">
                      <span className="flex items-center gap-1 text-amber-300/80">
                        <Key className="w-3.5 h-3.5" />
                        <span>Key Recipient: <strong className="text-white font-medium">{a.keyRecipient || a.memberName}</strong></span>
                      </span>

                      <span>·</span>

                      <span>
                        {t("locker.issuedAt")} {assignDate.toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")} ({relativeText})
                      </span>

                      {a.returnedAt && (
                        <>
                          <span>·</span>
                          <span className="text-zinc-500">
                            Returned {new Date(a.returnedAt).toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")}
                          </span>
                        </>
                      )}

                      {a.lostKeyFee > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-red-400 font-semibold">
                            Fee: {state.settings.currency} {a.lostKeyFee}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 uppercase tracking-wide ${chip}`}>
                    {a.status === "active" ? t("locker.status.IN_USE") : a.status === "lost" ? "LOST KEY" : "RETURNED"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <LockerActionModal
            locker={selected}
            onClose={() => setSelected(null)}
            onEdit={l => {
              setSelected(null);
              setEditingLocker(l);
            }}
            actor={actor}
          />
        )}
        {showAdd && <AddLockerModal onClose={() => setShowAdd(false)} />}
        {editingLocker && (
          <EditLockerModal locker={editingLocker} onClose={() => setEditingLocker(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------- Modal : Action sur un casier ---------------------------- */

function LockerActionModal({
  locker,
  onClose,
  onEdit,
  actor,
}: {
  locker: Locker;
  onClose: () => void;
  onEdit: (l: Locker) => void;
  actor: string;
}) {
  const { state, dispatch } = useGym();
  const t = useT();
  const assignment = activeAssignmentOf(state, locker.id);
  const [memberId, setMemberId] = useState("");
  const [keyRecipient, setKeyRecipient] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("200");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When member changes, pre-fill keyRecipient with member's name
  const handleMemberChange = (id: string) => {
    setMemberId(id);
    const m = state.members.find(x => x.id === id);
    if (m) {
      setKeyRecipient(m.name);
    } else {
      setKeyRecipient("");
    }
  };

  const handleIssue = async () => {
    const member = state.members.find(m => m.id === memberId);
    if (!member) {
      toast.error(t("locker.fillRequired"));
      return;
    }
    const finalRecipient = keyRecipient.trim() || member.name;
    setIsSubmitting(true);
    try {
      const res = await assignLockerInDatabase({
        lockerId: locker.id,
        memberId: member.id,
        memberName: member.name,
        keyRecipient: finalRecipient,
        actor,
        dueDate: dueDate || null,
        notes: notes.trim(),
      });
      if (res.error) {
        toast.error(res.error);
      } else if (res.assignment) {
        dispatch({ type: "ADD_LOCKER_ASSIGNMENT", payload: res.assignment });
        dispatch({ type: "UPDATE_LOCKER", payload: { ...locker, status: "IN_USE" } });
        addAudit(dispatch, "Locker Issued", actor, `${locker.number} → ${member.name} (Key: ${finalRecipient})`);
        toast.success(t("locker.issueSuccess", { n: locker.number, name: member.name }));
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign locker");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!assignment) return;
    setIsSubmitting(true);
    try {
      const res = await releaseLockerInDatabase(assignment.id, locker.id, actor);
      if (res.error) {
        toast.error(res.error);
      } else {
        dispatch({
          type: "UPDATE_LOCKER_ASSIGNMENT",
          payload: { ...assignment, status: "returned", keyReturned: true, returnedAt: new Date().toISOString() },
        });
        dispatch({ type: "UPDATE_LOCKER", payload: { ...locker, status: "AVAILABLE" } });
        addAudit(dispatch, "Locker Returned", actor, `${locker.number} ← ${assignment.memberName}`);
        toast.success(t("locker.returnSuccess", { n: locker.number }));
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to release locker");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLostKey = async () => {
    if (!assignment) return;
    setIsSubmitting(true);
    try {
      const numFee = Number(fee) || 0;
      const res = await reportLostKeyInDatabase(assignment.id, locker.id, actor, numFee);
      if (res.error) {
        toast.error(res.error);
      } else {
        dispatch({
          type: "UPDATE_LOCKER_ASSIGNMENT",
          payload: { ...assignment, status: "lost", keyReturned: false, returnedAt: new Date().toISOString(), lostKeyFee: numFee },
        });
        dispatch({
          type: "UPDATE_LOCKER",
          payload: { ...locker, status: "OUT_OF_SERVICE", notes: t("locker.lostKey") },
        });
        addAudit(dispatch, "Locker Key Lost", actor, `${locker.number} — ${assignment.memberName} (${state.settings.currency} ${numFee})`);
        toast.success(t("locker.lostSuccess", { n: locker.number }));
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to report lost key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAvailable = async () => {
    setIsSubmitting(true);
    try {
      const res = await updateLockerInDatabase(locker.id, { status: "AVAILABLE", notes: "" });
      if (res.error) {
        toast.error(res.error);
      } else {
        dispatch({ type: "UPDATE_LOCKER", payload: { ...locker, status: "AVAILABLE", notes: "" } });
        toast.success(t("locker.status.AVAILABLE"));
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setIsSubmitting(false);
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
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
              <Lockers weight="fill" className="w-6 h-6 text-lime-400" /> {locker.number}
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              {t("locker.keyTag")}: <strong className="text-zinc-300">{locker.keyTag || "—"}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(locker)}
              title={t("locker.edit")}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
            >
              <PencilSimple className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5 ${STATUS_STYLE[locker.status].chip}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[locker.status].dot}`} />
          {t(`locker.status.${locker.status}`)}
        </div>

        {locker.status === "AVAILABLE" && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t("locker.selectMember")}</label>
              <select
                value={memberId}
                onChange={e => handleMemberChange(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select Member —</option>
                {state.members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.memberId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                {t("locker.keyRecipient")} <span className="text-lime-400">*</span>
              </label>
              <input
                value={keyRecipient}
                onChange={e => setKeyRecipient(e.target.value)}
                placeholder="Full name of person receiving key"
                className={inputClass}
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Records who physically received the locker key. Defaults to member's name.
              </p>
            </div>

            <div>
              <label className={labelClass}>{t("locker.dueDateOptional")}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>{t("common.notes")}</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note" className={inputClass} />
            </div>

            <button
              onClick={handleIssue}
              disabled={isSubmitting || !memberId}
              className="w-full bg-lime-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-lime-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check weight="bold" className="w-4 h-4" />
              {isSubmitting ? "Saving to Database..." : t("locker.issue")}
            </button>
          </div>
        )}

        {locker.status === "IN_USE" && assignment && (
          <div className="space-y-4">
            <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white font-semibold">
                <User className="w-4 h-4 text-lime-400" />
                <span>Assigned Member: {assignment.memberName}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg font-medium">
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Key Recipient: <strong className="text-white">{assignment.keyRecipient || assignment.memberName}</strong></span>
              </div>

              <div className="text-xs text-zinc-400 pt-1 space-y-1">
                <div>
                  {t("locker.issuedAt")}: {new Date(assignment.assignedAt).toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")}
                </div>
                <div>
                  {t("locker.issuedBy")}: {assignment.issuedBy}
                </div>
                {assignment.dueDate && (
                  <div>
                    {t("locker.dueDate")}: {new Date(assignment.dueDate).toLocaleDateString(state.language === "am" ? "am-ET" : "en-US")}
                  </div>
                )}
                {assignment.notes && (
                  <div className="text-zinc-500 italic mt-1">Note: {assignment.notes}</div>
                )}
              </div>
            </div>

            <button
              onClick={handleReturn}
              disabled={isSubmitting}
              className="w-full bg-emerald-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-emerald-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyReturn weight="bold" className="w-4 h-4" />
              {isSubmitting ? "Updating Database..." : t("locker.return")}
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
                onClick={handleLostKey}
                disabled={isSubmitting}
                className="w-full bg-red-400/15 text-red-400 border border-red-400/40 py-3 rounded-xl font-bold hover:bg-red-400/25 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle weight="bold" className="w-4 h-4" />
                {isSubmitting ? "Updating..." : t("locker.lostKey")}
              </button>
            </div>
          </div>
        )}

        {locker.status === "OUT_OF_SERVICE" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-xl p-4">
              <Warning className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-bold">{t("locker.outOfService")}</div>
                {locker.notes && <div className="text-xs text-red-300/80 mt-1">{locker.notes}</div>}
              </div>
            </div>
            <button
              onClick={handleMarkAvailable}
              disabled={isSubmitting}
              className="w-full bg-zinc-800 border border-zinc-700 py-3 rounded-xl font-bold text-white hover:bg-zinc-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check weight="bold" className="w-4 h-4" />
              {isSubmitting ? "Updating..." : t("locker.status.AVAILABLE")}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------- Modal : Ajout d'un casier ---------------------------- */
// Requirement 2: Clean form with only required fields (Section buttons and Bulk Add removed)

function AddLockerModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useGym();
  const t = useT();
  const [number, setNumber] = useState("");
  const [keyTag, setKeyTag] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<LockerStatus>("AVAILABLE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    const trimmedNumber = number.trim();
    if (!trimmedNumber) {
      toast.error(t("locker.fillRequired"));
      return;
    }

    // Check duplicate locker number
    if (state.lockers.some(l => l.number.toLowerCase() === trimmedNumber.toLowerCase())) {
      toast.error(`Locker "${trimmedNumber}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createLockerInDatabase({
        number: trimmedNumber,
        keyTag: keyTag.trim() || `K-${trimmedNumber}`,
        status,
        notes: notes.trim(),
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        dispatch({ type: "ADD_LOCKER", payload: res.locker });
        toast.success(`Locker ${trimmedNumber} created in database!`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create locker in database");
    } finally {
      setIsSubmitting(false);
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
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
            <Lockers weight="fill" className="w-6 h-6 text-lime-400" />
            {t("locker.add")}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              {t("locker.number")} <span className="text-lime-400">*</span>
            </label>
            <input
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="e.g. L-101"
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>{t("locker.keyTag")}</label>
            <input
              value={keyTag}
              onChange={e => setKeyTag(e.target.value)}
              placeholder="e.g. K-101 (optional)"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>{t("locker.status")}</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as LockerStatus)}
              className={inputClass}
            >
              <option value="AVAILABLE">{t("locker.status.AVAILABLE")}</option>
              <option value="OUT_OF_SERVICE">{t("locker.status.OUT_OF_SERVICE")}</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>{t("common.notes")}</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              className={inputClass}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={isSubmitting || !number.trim()}
              className="w-full bg-lime-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-lime-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check weight="bold" className="w-4 h-4" />
              {isSubmitting ? "Saving to Database..." : t("common.save")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------- Modal : Édition d'un casier ---------------------------- */
// Requirement 7: Smooth editing of existing locker, saved directly to database without duplicates

function EditLockerModal({ locker, onClose }: { locker: Locker; onClose: () => void }) {
  const { dispatch } = useGym();
  const t = useT();
  const [number, setNumber] = useState(locker.number);
  const [keyTag, setKeyTag] = useState(locker.keyTag || "");
  const [status, setStatus] = useState<LockerStatus>(locker.status);
  const [notes, setNotes] = useState(locker.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = async () => {
    const trimmedNumber = number.trim();
    if (!trimmedNumber) {
      toast.error(t("locker.fillRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateLockerInDatabase(locker.id, {
        number: trimmedNumber,
        keyTag: keyTag.trim(),
        status,
        notes: notes.trim(),
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        const updated: Locker = {
          ...locker,
          number: trimmedNumber,
          keyTag: keyTag.trim(),
          status,
          notes: notes.trim(),
          updatedAt: new Date().toISOString(),
        };
        dispatch({ type: "UPDATE_LOCKER", payload: updated });
        toast.success(t("locker.editSuccess"));
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update locker in database");
    } finally {
      setIsSubmitting(false);
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
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
            <PencilSimple className="w-5 h-5 text-lime-400" />
            {t("locker.edit")}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              {t("locker.number")} <span className="text-lime-400">*</span>
            </label>
            <input
              value={number}
              onChange={e => setNumber(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>{t("locker.keyTag")}</label>
            <input
              value={keyTag}
              onChange={e => setKeyTag(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>{t("locker.status")}</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as LockerStatus)}
              className={inputClass}
            >
              <option value="AVAILABLE">{t("locker.status.AVAILABLE")}</option>
              <option value="IN_USE">{t("locker.status.IN_USE")}</option>
              <option value="OUT_OF_SERVICE">{t("locker.status.OUT_OF_SERVICE")}</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>{t("common.notes")}</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              className={inputClass}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleUpdate}
              disabled={isSubmitting || !number.trim()}
              className="w-full bg-lime-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-lime-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check weight="bold" className="w-4 h-4" />
              {isSubmitting ? "Saving to Database..." : t("common.save")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}