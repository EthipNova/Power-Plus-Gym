import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChalkboardTeacher,
  CalendarDots,
  Users,
  Clock,
  MapPin,
  Lightning,
  CheckCircle,
  Circle,
  X,
  NotePencil,
  Phone,
  Envelope,
  IdentificationBadge,
  TrendUp,
  ClipboardText,
  WarningCircle,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { useGym, generateId, addAudit } from "../context/GymContext";
import type { GymClass, Trainer, TrainerClientNote } from "../types";
import {
  fetchTrainerProfileData,
  type TrainerProfileState,
  type RealTrainerSession,
  type RealTrainerTrainee,
} from "../services/trainerProfileService";
import {
  fetchSessionRosterWithAttendance,
  recordSessionAttendance,
  getGymLocalDateString,
  type SessionRosterResult,
  type SessionAttendanceStatus,
} from "../services/sessionAttendanceService";
import {
  fetchTrainerNotes,
  createTrainerNote,
  type TrainerCoachingNote,
} from "../services/trainerNotesService";
import { toast } from "sonner";

type Tab = "schedule" | "trainees" | "profile";
type Range = "today" | "all";

const CATEGORY_STYLES: Record<string, string> = {
  HIIT: "bg-red-400/10 text-red-400 border-red-400/20",
  Strength: "bg-lime-400/10 text-lime-400 border-lime-400/20",
  Yoga: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  Cardio: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  Boxing: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  Spin: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20",
};

export default function TrainerPortal() {
  const { state } = useGym();
  const [tab, setTab] = useState<Tab>("schedule");
  const [range, setRange] = useState<Range>("all");
  const [rosterClass, setRosterClass] = useState<GymClass | null>(null);
  const [rosterSession, setRosterSession] = useState<{
    id: string;
    title: string;
    dayOfWeek?: string | number | null;
    time?: string;
    trainerName?: string;
  } | null>(null);

  // Real database trainer profile state
  const [profileState, setProfileState] = useState<TrainerProfileState>({ status: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    const currentUserId = state.currentUser?.id;

    if (!currentUserId) {
      setProfileState({ status: "not_found", message: "No active user session." });
      return;
    }

    setProfileState({ status: "loading" });

    fetchTrainerProfileData(currentUserId).then((res) => {
      if (!isCancelled) {
        setProfileState(res);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [state.currentUser?.id, retryKey]);

  const handleRetry = useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  // Fallback for legacy demo trainers in local mock state (e.g. t1)
  const mockTrainer = useMemo(() => {
    return state.trainers.find((t) => t.id === state.currentUser?.trainerId);
  }, [state.trainers, state.currentUser?.trainerId]);

  // Resolved Trainer Object
  const trainer: Trainer | null = useMemo(() => {
    if (profileState.status === "success") {
      const p = profileState.profile;
      return {
        id: p.id,
        name: p.fullName,
        email: p.email || "—",
        phone: p.phone || "—",
        specialties: p.specialties,
        bio: p.specialization
          ? `Certified instructor specializing in ${p.specialization}.`
          : "Personal trainer at Power Plus Gym.",
        active: p.isActive,
        clientIds: profileState.trainees.map((t) => t.id),
        weeklyHours: profileState.weeklyHours,
      };
    }
    if (mockTrainer) {
      return mockTrainer;
    }
    return null;
  }, [profileState, mockTrainer]);

  const todayName = useMemo(() => new Date().toLocaleDateString("en-US", { weekday: "long" }), []);

  // Real database sessions if available, otherwise mock classes
  const realSessions: RealTrainerSession[] = useMemo(() => {
    if (profileState.status === "success") {
      return profileState.sessions;
    }
    return [];
  }, [profileState]);

  const realTrainees: RealTrainerTrainee[] = useMemo(() => {
    if (profileState.status === "success") {
      return profileState.trainees;
    }
    return [];
  }, [profileState]);

  const filteredSessions = useMemo(() => {
    if (range === "today") {
      return realSessions.filter((s) => s.days.some((d) => d.toLowerCase() === todayName.toLowerCase()));
    }
    return realSessions;
  }, [realSessions, range, todayName]);

  // Loading State
  if (profileState.status === "loading") {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center mb-4">
          <ChalkboardTeacher weight="fill" className="w-8 h-8 text-lime-400 animate-pulse" />
        </div>
        <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Connecting to Trainer Portal...</p>
      </div>
    );
  }

  // Error State (distinguished from missing profile)
  if (profileState.status === "error" && !mockTrainer) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-zinc-900 border border-red-500/30 rounded-2xl p-6">
          <WarningCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Error Loading Trainer Profile</h2>
          <p className="text-zinc-400 text-sm mb-5">{profileState.error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 bg-lime-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors"
          >
            <ArrowClockwise className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!trainer) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <ChalkboardTeacher className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Trainer Profile</h2>
          <p className="text-zinc-500">Please log in as a trainer to access this portal.</p>
        </div>
      </div>
    );
  }

  const totalClasses = realSessions.length > 0
    ? realSessions.length
    : state.classes.filter((c) => c.trainerId === trainer.id).length;

  const totalRoster = realTrainees.length > 0
    ? realTrainees.length
    : new Set(
        state.classAttendees
          .filter((a) => state.classes.some((c) => c.id === a.classId && c.trainerId === trainer.id))
          .map((a) => a.memberId)
      ).size;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <ChalkboardTeacher weight="fill" className="w-6 h-6 text-lime-400" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Trainer Portal</h1>
        </div>
        <p className="text-zinc-500 text-sm mb-8">
          Welcome back, {trainer.name}. Manage your classes, trainees and schedule.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "My Classes / Sessions", value: String(totalClasses), icon: CalendarDots },
            { label: "Active Trainees", value: String(totalRoster), icon: Users },
            { label: "Weekly Hours", value: String(trainer.weeklyHours), icon: Clock },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
            >
              <div className="bg-lime-400/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                <s.icon weight="fill" className="w-5 h-5 text-lime-400" />
              </div>
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-sm text-zinc-500">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {(["schedule", "trainees", "profile"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {t === "schedule" ? "My Schedule" : t === "trainees" ? "My Trainees" : "My Profile"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "schedule" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(["today", "all"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                        range === r
                          ? "bg-lime-400/20 text-lime-400 border border-lime-400/30"
                          : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800"
                      }`}
                    >
                      {r === "today" ? "Today" : "This Week"}
                    </button>
                  ))}
                </div>

                {/* Real database sessions */}
                {realSessions.length > 0 ? (
                  filteredSessions.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                      <CalendarDots className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                      <p className="text-zinc-500">
                        No sessions scheduled {range === "today" ? "for today" : "this week"}.
                      </p>
                    </div>
                  ) : (
                    filteredSessions.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-bold text-lg">{s.name}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-lime-400/10 text-lime-400 border-lime-400/20">
                                Aerobics & Group
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-800 text-zinc-400">
                                {s.status}
                              </span>
                            </div>
                            <p className="text-zinc-500 text-sm mb-3">
                              {s.description || "Scheduled group training session."}
                            </p>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
                              <span className="flex items-center gap-1.5">
                                <CalendarDots className="w-4 h-4 text-lime-400" />
                                {s.days.join(", ")}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-lime-400" />
                                {s.timeSlot}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-lime-400" />
                                Studio Room
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-start md:items-end gap-2">
                            <div className="text-sm text-zinc-400">
                              <span className="font-bold text-white">{s.enrolledCount}</span> / {s.capacity} enrolled
                            </div>
                            <div className="w-32 bg-zinc-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-lime-400 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (s.enrolledCount / Math.max(1, s.capacity)) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="text-xs text-zinc-500">
                              {s.durationHours} hr session
                            </div>
                            <button
                              onClick={() =>
                                setRosterSession({
                                  id: s.id,
                                  title: s.name,
                                  dayOfWeek: s.days?.join(", ") || "",
                                  time: s.timeSlot,
                                  trainerName: trainer.name,
                                })
                              }
                              className="mt-1 bg-lime-400 text-zinc-950 px-3.5 py-1.5 rounded-xl font-bold text-xs hover:bg-lime-300 transition-colors active:scale-[0.97] flex items-center gap-1.5"
                            >
                              <ClipboardText className="w-4 h-4" />
                              Take Attendance
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                    <CalendarDots className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-500">
                      No sessions assigned in the database {range === "today" ? "for today" : "this week"}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === "trainees" && (
              <TraineesView
                trainer={trainer}
                realTrainees={realTrainees}
                totalRoster={totalRoster}
              />
            )}

            {tab === "profile" && (
              <ProfileView
                trainer={trainer}
                sessions={realSessions}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {rosterSession && <RosterDrawer session={rosterSession} onClose={() => setRosterSession(null)} />}
        {rosterClass && (
          <RosterDrawer
            session={{
              id: rosterClass.id,
              title: rosterClass.title,
              dayOfWeek: rosterClass.dayOfWeek,
              time: rosterClass.time,
              trainerName: rosterClass.trainerName,
            }}
            onClose={() => setRosterClass(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RosterDrawer({
  session,
  onClose,
}: {
  session: {
    id: string;
    title: string;
    dayOfWeek?: string | number | null;
    time?: string;
    trainerName?: string;
  };
  onClose: () => void;
}) {
  const { dispatch } = useGym();
  const [selectedDate, setSelectedDate] = useState(() => getGymLocalDateString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterResult, setRosterResult] = useState<SessionRosterResult | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSessionRosterWithAttendance(session.id, selectedDate);
      setRosterResult(res);
    } catch (err: any) {
      console.error("[RosterDrawer] Failed to load attendance:", err);
      setError(err?.message || "Failed to load session roster and attendance.");
    } finally {
      setLoading(false);
    }
  }, [session.id, selectedDate]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const handleUpdate = async (
    traineeId: string,
    traineeName: string,
    targetStatus: SessionAttendanceStatus
  ) => {
    if (savingIds.has(traineeId)) return;

    setSavingIds((prev) => new Set(prev).add(traineeId));
    try {
      const saved = await recordSessionAttendance({
        sessionId: session.id,
        customerId: traineeId,
        attendanceDate: selectedDate,
        status: targetStatus,
      });

      setRosterResult((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((item) => {
          if (item.trainee.id !== traineeId) return item;
          return {
            ...item,
            status: saved.status,
            recordId: saved.id,
            recordedAt: saved.recordedAt,
            notes: saved.notes,
          };
        });

        const presentCount = updatedItems.filter((i) => i.status === "PRESENT").length;
        const absentCount = updatedItems.filter((i) => i.status === "ABSENT").length;
        const unrecordedCount = updatedItems.filter((i) => i.status === "UNRECORDED").length;

        return {
          ...prev,
          items: updatedItems,
          presentCount,
          absentCount,
          unrecordedCount,
        };
      });

      addAudit(
        dispatch,
        "Session Attendance Recorded",
        session.trainerName || "Trainer",
        `${traineeName} marked ${targetStatus} for ${session.title} (${selectedDate})`
      );

      toast.success(`${traineeName} marked ${targetStatus.toLowerCase()}`);
    } catch (err: any) {
      console.error("[RosterDrawer] Save error:", err);
      toast.error(err?.message || `Failed to record attendance for ${traineeName}.`);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(traineeId);
        return next;
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ClipboardText className="w-5 h-5 text-lime-400" /> Attendance Roster
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {session.title} {session.time ? `· ${session.time}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Date Selector & Refresh */}
        <div className="flex items-center justify-between gap-3 mb-5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CalendarDots className="w-4 h-4 text-lime-400" />
            <span>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-lime-400"
            />
          </div>
          <button
            onClick={() => loadRoster()}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Refresh attendance"
          >
            <ArrowClockwise className={`w-4 h-4 ${loading ? "animate-spin text-lime-400" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <ArrowClockwise className="w-8 h-8 text-lime-400 animate-spin mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Loading session roster...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center my-4">
            <WarningCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-red-300 mb-3">{error}</p>
            <button
              onClick={() => loadRoster()}
              className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
            >
              Retry
            </button>
          </div>
        ) : !rosterResult || rosterResult.items.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No members enrolled in this session yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm text-zinc-400">
                <strong className="text-white">{rosterResult.presentCount}</strong> / {rosterResult.totalEnrolled} present
                {rosterResult.absentCount > 0 && (
                  <span className="ml-1 text-zinc-500">({rosterResult.absentCount} absent)</span>
                )}
                {rosterResult.unrecordedCount > 0 && (
                  <span className="ml-1 text-amber-400/80">({rosterResult.unrecordedCount} unrecorded)</span>
                )}
              </span>
              <span className="text-xs text-lime-400 font-semibold">
                {rosterResult.totalEnrolled > 0
                  ? `${Math.round((rosterResult.presentCount / rosterResult.totalEnrolled) * 100)}%`
                  : "0%"}
              </span>
            </div>

            {rosterResult.items.map((item) => {
              const isSaving = savingIds.has(item.trainee.id);
              const isPresent = item.status === "PRESENT";
              const isAbsent = item.status === "ABSENT";
              const isUnrecorded = item.status === "UNRECORDED";

              return (
                <div
                  key={item.trainee.id}
                  className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 hover:border-zinc-600 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm truncate">{item.trainee.fullName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {item.trainee.customerCode}
                      </span>
                      {isUnrecorded && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-medium">
                          Unrecorded
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">
                      {item.trainee.phone || item.trainee.email || "No contact"}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      disabled={isSaving}
                      onClick={() => handleUpdate(item.trainee.id, item.trainee.fullName, "PRESENT")}
                      title="Mark Present"
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isPresent
                          ? "bg-lime-400 text-zinc-950 shadow-sm"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <CheckCircle weight={isPresent ? "fill" : "bold"} className="w-4 h-4" />
                      <span>Present</span>
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={() => handleUpdate(item.trainee.id, item.trainee.fullName, "ABSENT")}
                      title="Mark Absent"
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isAbsent
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <X weight={isAbsent ? "bold" : "regular"} className="w-4 h-4" />
                      <span>Absent</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function TraineesView({
  trainer,
  realTrainees,
  totalRoster,
}: {
  trainer: Trainer;
  realTrainees: RealTrainerTrainee[];
  totalRoster: number;
}) {
  const { state, dispatch } = useGym();

  // If real trainees exist from database, use them; otherwise fallback to local mock trainees
  const hasRealTrainees = realTrainees.length > 0;
  const [selectedId, setSelectedId] = useState<string | null>(
    hasRealTrainees ? realTrainees[0]?.id : trainer.clientIds[0] ?? null
  );

  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [coachingNotes, setCoachingNotes] = useState<TrainerCoachingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedReal = hasRealTrainees ? realTrainees.find((t) => t.id === selectedId) : null;
  const selectedMock = !hasRealTrainees ? state.members.find((m) => m.id === selectedId) : null;

  const loadNotes = useCallback(async (customerId: string) => {
    setLoadingNotes(true);
    setNotesError(null);
    try {
      const records = await fetchTrainerNotes(customerId);
      setCoachingNotes(records);
    } catch (err: any) {
      console.error("[TrainerPortal] Failed to load coaching notes:", err);
      setNotesError(err?.message || "Failed to load coaching notes from database.");
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadNotes(selectedId);
    } else {
      setCoachingNotes([]);
    }
  }, [selectedId, loadNotes]);

  const addNote = async () => {
    if (isSaving) return;
    if (!selectedId || !focus.trim() || !notes.trim()) {
      toast.error("Please add a workout focus and note.");
      return;
    }

    const traineeName = selectedReal?.fullName || selectedMock?.name || "Trainee";
    setIsSaving(true);
    try {
      const savedNote = await createTrainerNote({
        trainerId: trainer.id,
        customerId: selectedId,
        workoutFocus: focus.trim(),
        notes: notes.trim(),
      });

      setCoachingNotes((prev) => [savedNote, ...prev]);
      addAudit(dispatch, "Trainer Note Added", trainer.name, `Logged coaching note for ${traineeName}`);
      toast.success("Coaching note saved successfully");
      setFocus("");
      setNotes("");
    } catch (err: any) {
      console.error("[TrainerPortal] Error saving coaching note:", err);
      toast.error(err?.message || `Failed to save coaching note for ${traineeName}.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-2">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-lime-400" /> Assigned Trainees{" "}
          <span className="text-xs text-zinc-500 font-normal">({totalRoster} enrolled)</span>
        </h3>

        {hasRealTrainees ? (
          realTrainees.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left rounded-xl p-3 border transition-colors ${
                selectedId === c.id
                  ? "bg-lime-400/10 border-lime-400/40"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="font-semibold text-sm">{c.fullName}</div>
              <div className="text-xs text-zinc-500">
                {c.customerCode} · {c.sessionName}
              </div>
            </button>
          ))
        ) : trainer.clientIds.length > 0 ? (
          state.members
            .filter((m) => trainer.clientIds.includes(m.id))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left rounded-xl p-3 border transition-colors ${
                  selectedId === c.id
                    ? "bg-lime-400/10 border-lime-400/40"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-zinc-500">
                  {c.memberId} · {c.phone}
                </div>
              </button>
            ))
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No trainees currently enrolled.</p>
          </div>
        )}
      </div>

      <div className="md:col-span-2 space-y-4">
        {(selectedReal || selectedMock) ? (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-lime-400/10 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-lime-400" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">
                      {selectedReal ? selectedReal.fullName : selectedMock?.name}
                    </div>
                    <div className="text-sm text-zinc-500">
                      {selectedReal
                        ? `${selectedReal.customerCode} · Enrolled in ${selectedReal.sessionName}`
                        : `${selectedMock?.memberId} · Member since ${selectedMock?.joinDate}`}
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Phone className="w-4 h-4 text-lime-400" />
                    {selectedReal ? selectedReal.phone || "—" : selectedMock?.phone}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Envelope className="w-4 h-4 text-lime-400" />
                    {selectedReal ? selectedReal.email || "—" : selectedMock?.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-bold flex items-center gap-2">
                  <NotePencil className="w-5 h-5 text-lime-400" /> Log Coaching Note
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-400/10 border border-lime-400/20 text-lime-400 font-semibold">
                  Persistent Journal
                </span>
              </div>
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                disabled={isSaving}
                placeholder="Workout focus (e.g. Squat form, yoga mobility, cardio endurance)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 focus:ring-1 focus:ring-lime-400/30 transition-colors disabled:opacity-50"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSaving}
                placeholder="Coach notes, form adjustments, next steps..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 focus:ring-1 focus:ring-lime-400/30 resize-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={addNote}
                disabled={isSaving}
                className={`bg-lime-400 text-zinc-950 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 ${
                  isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-lime-300 active:scale-[0.98]"
                }`}
              >
                {isSaving && <ArrowClockwise className="w-4 h-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save Note"}
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h4 className="font-bold flex items-center gap-2">
                  <Lightning className="w-5 h-5 text-lime-400" /> Coaching History
                </h4>
                {selectedId && (
                  <button
                    onClick={() => loadNotes(selectedId)}
                    disabled={loadingNotes}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    title="Refresh notes"
                  >
                    <ArrowClockwise className={`w-4 h-4 ${loadingNotes ? "animate-spin text-lime-400" : ""}`} />
                  </button>
                )}
              </div>
              {loadingNotes ? (
                <div className="text-center py-6">
                  <ArrowClockwise className="w-6 h-6 text-lime-400 animate-spin mx-auto mb-2" />
                  <p className="text-zinc-400 text-xs">Loading coaching history...</p>
                </div>
              ) : notesError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center my-2">
                  <p className="text-xs text-red-300 mb-2">{notesError}</p>
                  <button
                    onClick={() => selectedId && loadNotes(selectedId)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1 rounded-lg font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : coachingNotes.length === 0 ? (
                <div className="text-center py-4">
                  <NotePencil className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No coaching notes recorded for this trainee yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coachingNotes.map((n) => (
                    <div key={n.id} className="border-l-2 border-lime-400/40 pl-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-white">{n.workoutFocus}</span>
                        <span className="text-zinc-500 text-xs">{n.sessionDate}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-0.5 whitespace-pre-wrap">{n.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Select a trainee from the list to view details or log session notes.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileView({
  trainer,
  sessions,
}: {
  trainer: Trainer;
  sessions: RealTrainerSession[];
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center">
            <ChalkboardTeacher weight="fill" className="w-8 h-8 text-lime-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              {trainer.name}{" "}
              {trainer.active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-400 font-bold">
                  ACTIVE
                </span>
              )}
            </h3>
            <p className="text-zinc-500 text-sm">{trainer.bio || "Personal trainer at Power Plus Gym."}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Envelope className="w-4 h-4 text-lime-400" />
            {trainer.email}
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Phone className="w-4 h-4 text-lime-400" />
            {trainer.phone}
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <IdentificationBadge className="w-4 h-4 text-lime-400" />
            Trainer ID: {trainer.id.slice(0, 8)}...
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4 text-lime-400" />
            {trainer.weeklyHours} hrs / week
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Specialties</div>
          <div className="flex flex-wrap gap-2">
            {trainer.specialties.map((s) => (
              <span
                key={s}
                className={`text-xs px-3 py-1.5 rounded-full border font-semibold ${
                  CATEGORY_STYLES[s] || "bg-zinc-800 text-zinc-300 border-zinc-700"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h4 className="font-bold mb-3">Weekly Teaching Load</h4>
        <div className="space-y-2">
          {sessions.length > 0 ? (
            sessions.map((s) => (
              <div
                key={s.id}
                className="flex justify-between items-center py-2 border-b border-zinc-800/50 text-sm last:border-b-0"
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-lime-400 rounded-full" />
                  {s.name}
                </span>
                <span className="text-zinc-500">
                  {s.days.join(", ")} · {s.timeSlot}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <CalendarDots className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No sessions assigned in the database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
