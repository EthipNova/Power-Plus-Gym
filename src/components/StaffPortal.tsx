import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, MagnifyingGlass, Lightning, CheckCircle, XCircle, User, Plus, Envelope, Phone, Clock, Warning, ShieldCheck, PaperPlaneTilt, GraduationCap, MoonStars, MusicNotes, Sparkle, Prohibit, Drop, Lockers, ArrowClockwise, SpinnerGap } from "@phosphor-icons/react";
import { useGym, useT, formatETB, generateId, sendEmail, addAudit, computeMemberStatus, evaluateAccess, planAppliesToCategory, categoryLabelOf, memberActiveLocker } from "../context/GymContext";
import { SteamOverview, SteamPurchaseForm, SteamCheckInButton, SteamActiveBadge } from "./SteamPanel";
import type { AccessDecision, CustomerCategory, Member, Visit } from "../types";
import { toast } from "sonner";
import { EMAIL_TEMPLATES, ALL_CATEGORIES } from "../constants";
import LockersManagement from "./LockersManagement";
import {
  validateCustomerInput,
  checkCustomerDuplicate,
  getNextCustomerCode,
  saveCustomerToDatabase,
} from "../lib/customerService";
import {
  fetchDatabaseMembersAndVisits,
  checkDuplicateCheckIn,
  recordCheckInToDatabase,
  filterMembers,
  type DuplicateCheckResult,
} from "../lib/checkInService";

const CATEGORY_ICONS: Record<CustomerCategory, typeof Sparkle> = { REGULAR: Sparkle, STUDENT: GraduationCap, MUSLIM: MoonStars, AEROBICS: MusicNotes };
function CategoryBadge({ category }: { category: CustomerCategory }) {
  const { state } = useGym();
  const Icon = CATEGORY_ICONS[category];
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300"><Icon weight="fill" className="w-3 h-3 text-lime-400" />{categoryLabelOf(state, category)}</span>;
}

function LockerBadge({ memberId }: { memberId: string }) {
  const { state } = useGym();
  const held = memberActiveLocker(state, memberId);
  if (!held) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-400">
      <Lockers weight="fill" className="w-3 h-3" />{held.locker.number}
    </span>
  );
}

const TABS = ["checkin", "lockers", "steam", "register", "communication"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  checkin: "staff.tab.checkin",
  lockers: "staff.tab.lockers",
  steam: "staff.tab.steam",
  register: "staff.tab.register",
  communication: "staff.tab.communication",
};

export default function StaffPortal() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("checkin");

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Users weight="fill" className="w-6 h-6 text-lime-400" />
          <h1 className="text-2xl font-black uppercase tracking-tight">{t("staff.title")}</h1>
        </div>
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {TABS.map(key => (
            <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === key ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{t(TAB_LABEL[key])}</button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {tab === "checkin" && <CheckInView />}
            {tab === "lockers" && <LockersManagement />}
            {tab === "steam" && <SteamView />}
            {tab === "register" && <RegisterView />}
            {tab === "communication" && <CommunicateView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function CheckInView() {
  const { state, dispatch } = useGym();
  const t = useT();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CustomerCategory | "ALL">("ALL");
  const [lastCheckIn, setLastCheckIn] = useState<{ member: Member; time: string } | null>(null);
  const [refused, setRefused] = useState<{ member: Member; decision: AccessDecision } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ member: Member; info: DuplicateCheckResult } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const actor = state.currentUser?.name || "Reception";

  // 1. Fetch real members and visits from the Supabase database
  const loadDatabaseMembers = async (showToast = false) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const result = await fetchDatabaseMembersAndVisits(state.plans, state.settings, state.members);
      if (result.error && result.members.length === 0) {
        setFetchError(result.error);
        if (showToast) toast.error("Could not sync with database: " + result.error);
      } else {
        dispatch({ type: "SET_MEMBERS", payload: result.members });
        dispatch({ type: "SET_VISITS", payload: result.visits });
        if (showToast) toast.success(`Synced ${result.members.length} members with database`);
      }
    } catch (err: any) {
      setFetchError(err?.message || "Failed to load members");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseMembers();
  }, []);

  // 2. Dynamic filtering by Category and Search (instant, non-stale)
  const results = useMemo(() => {
    return filterMembers(state.members, categoryFilter, search);
  }, [state.members, categoryFilter, search]);

  // Dynamic counts for each category filter badge
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: state.members.length };
    state.members.forEach(m => {
      const cat = m.category || "REGULAR";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [state.members]);

  const recordDeniedAudit = (member: Member, decision: AccessDecision) => {
    addAudit(dispatch, "Access denied", actor, `${member.name} (${member.memberId}) · ${decision.message}`);
  };

  const recordVisit = async (member: Member, accessStatus: "allowed" | "override", reason?: string) => {
    setIsCheckingIn(member.id);
    try {
      const res = await recordCheckInToDatabase(member, accessStatus, actor, reason);
      const category = member.category || "REGULAR";

      // Immediate UI update in context
      dispatch({ type: "ADD_VISIT", payload: res.visit });
      dispatch({ type: "UPDATE_MEMBER", payload: { ...member, lastVisit: res.visit.timestamp } });

      addAudit(
        dispatch,
        accessStatus === "override" ? "Check-in (override)" : "Check-in",
        actor,
        `${member.name} (${member.memberId}) · ${categoryLabelOf(state, category)}${reason ? ` · ${reason}` : ""}`
      );

      setLastCheckIn({ member, time: new Date().toLocaleTimeString() });
      setRefused(null);
      setDuplicateWarning(null);
      toast.success(t("staff.checkedIn", { name: member.name }) || `${member.name} checked in successfully!`);
    } catch (err: any) {
      console.error("Check-in error:", err);
      toast.error("Failed to complete check-in: " + (err?.message || "Unknown error"));
    } finally {
      setIsCheckingIn(null);
    }
  };

  const handleCheckIn = (member: Member) => {
    // Check status (expired or blocked)
    const status = computeMemberStatus(member, state.settings);
    if (status === "expired" || status === "blocked") {
      toast.error(
        t("staff.expiredCannot", { name: member.name, status: t(`status.${status}`).toLowerCase() }) ||
        `${member.name} cannot check in: membership is ${status}.`
      );
      return;
    }

    // Evaluate time access rules
    const decision = evaluateAccess(member, state.accessRules, new Date());
    if (!decision.allowed) {
      recordDeniedAudit(member, decision);
      setRefused({ member, decision });
      setDuplicateWarning(null);
      toast.error(`${t("staff.accessDenied")} — ${member.name}`);
      return;
    }

    // Check duplicate check-in today
    const dup = checkDuplicateCheckIn(member, state.visits);
    if (dup.isDuplicate) {
      setDuplicateWarning({ member, info: dup });
      setRefused(null);
      toast.warning(`${member.name} has already checked in today at ${dup.formattedTime}`);
      return;
    }

    recordVisit(member, "allowed");
  };

  const statusBadge = (m: Member) => {
    const s = computeMemberStatus(m, state.settings);
    const map: Record<string, string> = {
      active: "bg-lime-400/20 text-lime-400",
      expiring: "bg-yellow-400/20 text-yellow-400",
      expired: "bg-red-400/20 text-red-400",
      inactive: "bg-zinc-400/20 text-zinc-400",
      blocked: "bg-purple-400/20 text-purple-400",
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[s] || "bg-zinc-800 text-zinc-300"}`}>{t(`status.${s}`) || s}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Search bar + Real-time Sync */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="w-6 h-6 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("staff.searchPlaceholder") || "Search member by name, phone, email, or ID..."}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white text-lg placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50"
            autoFocus
          />
        </div>
        <button
          onClick={() => loadDatabaseMembers(true)}
          disabled={isLoading}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-5 rounded-2xl flex items-center gap-2 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
          title="Sync with database"
        >
          <ArrowClockwise className={`w-5 h-5 text-lime-400 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline text-sm font-semibold">{isLoading ? "Syncing..." : "Sync DB"}</span>
        </button>
      </div>

      {/* Category Filter Pills with Live Member Counts */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            categoryFilter === "ALL" ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <span>{t("staff.allCategories") || "All Categories"}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-bold">
            {categoryCounts.ALL || 0}
          </span>
        </button>
        {state.categoryLabels.map(c => {
          const count = categoryCounts[c.category] || 0;
          return (
            <button
              key={c.category}
              onClick={() => setCategoryFilter(c.category)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                categoryFilter === c.category ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              <span>{c.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-bold">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="text-sm text-red-300">
            <strong>Database Notice:</strong> {fetchError}
          </div>
          <button
            onClick={() => loadDatabaseMembers(true)}
            className="text-xs bg-red-400/20 text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-400/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Access Denied Card (Rule Violation) */}
      {refused && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Prohibit weight="fill" className="w-8 h-8 text-red-400 shrink-0" />
            <div>
              <div className="font-bold text-red-400">{t("staff.accessDenied") || "Access Denied"} — {refused.member.name}</div>
              <div className="text-sm text-zinc-400">{refused.decision.message}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => recordVisit(refused.member, "override", `Time restriction override: ${refused.decision.message}`)}
              className="flex-1 bg-lime-400 text-zinc-950 font-bold text-sm py-2.5 rounded-xl hover:bg-lime-300"
            >
              {t("staff.allowOverride") || "Allow Override"}
            </button>
            <button
              onClick={() => setRefused(null)}
              className="flex-1 bg-zinc-800 text-zinc-200 font-semibold text-sm py-2.5 rounded-xl hover:bg-zinc-700"
            >
              {t("common.cancel") || "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Check-In Warning Card */}
      {duplicateWarning && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Warning weight="fill" className="w-8 h-8 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-amber-400">
                Already Checked In Today — {duplicateWarning.member.name}
              </div>
              <div className="text-sm text-zinc-300">
                This member checked in today at{" "}
                <span className="font-bold text-white">{duplicateWarning.info.formattedTime}</span>
                {duplicateWarning.info.minutesAgo !== undefined && (
                  <span> ({duplicateWarning.info.minutesAgo} min ago)</span>
                )}.
                Gym policy prevents duplicate entries. Do you want to record an authorized override?
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => recordVisit(duplicateWarning.member, "override", `Duplicate check-in override (checked in earlier at ${duplicateWarning.info.formattedTime})`)}
              className="flex-1 bg-amber-400 text-zinc-950 font-bold text-sm py-2.5 rounded-xl hover:bg-amber-300"
            >
              Allow Override Check-In
            </button>
            <button
              onClick={() => setDuplicateWarning(null)}
              className="flex-1 bg-zinc-800 text-zinc-200 font-semibold text-sm py-2.5 rounded-xl hover:bg-zinc-700"
            >
              {t("common.cancel") || "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Last Successful Check-In Banner */}
      {lastCheckIn && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-lime-400/10 border border-lime-400/30 rounded-2xl p-4 flex items-center gap-4">
          <CheckCircle weight="fill" className="w-8 h-8 text-lime-400 shrink-0" />
          <div>
            <div className="font-bold text-lime-400">{t("staff.checkedIn", { name: lastCheckIn.member.name }) || `${lastCheckIn.member.name} checked in!`}</div>
            <div className="text-sm text-zinc-400">{lastCheckIn.time} | {lastCheckIn.member.memberId} ({categoryLabelOf(state, lastCheckIn.member.category || "REGULAR")})</div>
          </div>
        </motion.div>
      )}

      {/* Loading Skeleton */}
      {isLoading && state.members.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <SpinnerGap className="w-8 h-8 mx-auto mb-3 text-lime-400 animate-spin" />
          <p className="font-semibold text-zinc-300">Loading members from database...</p>
        </div>
      )}

      {/* Member Results List */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>
              {categoryFilter === "ALL"
                ? `Showing ${results.length} member${results.length === 1 ? "" : "s"} from database`
                : `Showing ${results.length} ${categoryLabelOf(state, categoryFilter)} member${results.length === 1 ? "" : "s"}`}
              {search.trim() ? ` matching "${search.trim()}"` : ""}
            </span>
          </div>

          <div className="space-y-2">
            {results.map(m => {
              const status = computeMemberStatus(m, state.settings);
              const isChecking = isCheckingIn === m.id;
              const isBlockedOrExpired = status === "expired" || status === "blocked";

              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start md:items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-base">{m.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                          {m.memberId}
                        </span>
                        {statusBadge(m)}
                        <CategoryBadge category={m.category || "REGULAR"} />
                        <SteamActiveBadge memberId={m.id} />
                        <LockerBadge memberId={m.id} />
                      </div>

                      <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>📞 {m.phone || "No phone"}</span>
                        {m.email && <span>✉️ {m.email}</span>}
                        {m.category === "STUDENT" && m.studentId && (
                          <span className="text-lime-400/90 font-medium">
                            🎓 ID: {m.studentId} {m.institution ? `(${m.institution})` : ""}
                          </span>
                        )}
                        <span>
                          📅 Expiry: {m.expiryDate || "N/A"}
                        </span>
                        {m.lastVisit && (
                          <span className="text-zinc-500">
                            🕒 Last: {new Date(m.lastVisit).toLocaleDateString()} {new Date(m.lastVisit).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <button
                      onClick={() => handleCheckIn(m)}
                      disabled={isBlockedOrExpired || isChecking}
                      className="bg-lime-400 text-zinc-950 px-6 py-3 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.95] flex items-center gap-2"
                    >
                      {isChecking ? (
                        <>
                          <SpinnerGap className="w-4 h-4 animate-spin" /> Checking in...
                        </>
                      ) : (
                        <>
                          <Lightning weight="fill" className="w-4 h-4" /> {t("staff.checkIn") || "Check In"}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State when no results found */}
      {results.length === 0 && !isLoading && (
        <div className="text-center py-12 text-zinc-500 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl">
          <Warning className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
          <p className="font-semibold text-zinc-300">
            {search.trim()
              ? `No members found matching "${search.trim()}"`
              : categoryFilter !== "ALL"
              ? `No members registered under ${categoryLabelOf(state, categoryFilter)}`
              : "No members registered yet"}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            {search.trim()
              ? "Check your spelling or switch category filter to view all members."
              : categoryFilter !== "ALL"
              ? "When new members register with this category, they will appear here automatically."
              : "Register your first member using the Register tab."}
          </p>
        </div>
      )}

      {/* Today's Check-Ins Log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-lime-400" /> {t("staff.todayCheckIns") || "Today's Check-Ins"}
          </h3>
          <span className="text-xs text-zinc-500">
            {state.visits.filter(v => v.timestamp.startsWith(new Date().toISOString().split("T")[0])).length} check-in(s) today
          </span>
        </div>
        <div className="space-y-2">
          {state.visits
            .filter(v => v.timestamp.startsWith(new Date().toISOString().split("T")[0]))
            .slice(0, 10)
            .map(v => {
              const m = state.members.find(mm => mm.id === v.memberId || mm.memberId === v.memberId);
              return (
                <div
                  key={v.id}
                  className="flex justify-between items-center text-sm py-2.5 border-b border-zinc-800/50"
                >
                  <span className="font-medium flex items-center gap-2">
                    <span>{m?.name || t("staff.unknown") || "Member"}</span>
                    {m?.memberId && (
                      <span className="text-xs font-mono text-zinc-500">({m.memberId})</span>
                    )}
                    <CategoryBadge category={v.category || m?.category || "REGULAR"} />
                    {v.accessStatus === "override" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 font-bold">
                        {t("staff.override") || "Override"}
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-500 text-xs">
                    {new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              );
            })}
          {state.visits.filter(v => v.timestamp.startsWith(new Date().toISOString().split("T")[0])).length === 0 && (
            <p className="text-sm text-zinc-500 py-4 text-center">{t("staff.noCheckIns") || "No check-ins recorded today yet."}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function emptyForm() {
  return { name: "", phone: "", email: "", planId: "", emergencyContact: "", emergencyPhone: "", medicalNotes: "", category: "REGULAR" as CustomerCategory, studentId: "", institution: "" };
}

function RegisterView() {
  const { state, dispatch } = useGym();
  const t = useT();
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actor = state.currentUser?.name || "Reception";
  const applicablePlans = state.plans.filter(p => p.active && planAppliesToCategory(p, form.category));

  const updateField = (key: keyof ReturnType<typeof emptyForm>, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleRegister = async () => {
    // 1. Strict frontend validation
    const validation = validateCustomerInput(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      const firstErr = Object.values(validation.errors)[0];
      toast.error(firstErr);
      return;
    }
    setErrors({});

    const plan = state.plans.find(p => p.id === form.planId);
    if (!plan) {
      setErrors(prev => ({ ...prev, planId: "Please choose a membership plan" }));
      toast.error("Please choose a membership plan that matches the category");
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. Duplicate checking (against both local state and remote Supabase database)
      const dupCheck = await checkCustomerDuplicate(form.phone, form.email, state.members);
      if (dupCheck.isDuplicate) {
        toast.error(dupCheck.reason || "Duplicate customer detected");
        setIsSubmitting(false);
        return;
      }

      // 3. Generate next sequential customer code
      const nextCode = await getNextCustomerCode(state.members);

      // 4. Save to corresponding database table (public.customers)
      const dbResult = await saveCustomerToDatabase(form, nextCode);
      if (!dbResult.success) {
        toast.error(dbResult.error || "Failed to save customer to database");
        setIsSubmitting(false);
        return;
      }

      // 5. Update local state and logs
      const newMember: Member = {
        id: dbResult.data?.id || generateId("m"),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        memberId: nextCode,
        planId: form.planId,
        joinDate: new Date().toISOString().split("T")[0],
        expiryDate: new Date(Date.now() + plan.durationDays * 86400000).toISOString().split("T")[0],
        status: "active",
        lastVisit: null,
        emergencyContact: form.emergencyContact.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
        medicalNotes: form.medicalNotes.trim(),
        emailNotifications: true,
        balanceDue: 0,
        category: form.category,
        studentId: form.category === "STUDENT" ? form.studentId?.trim() : undefined,
        institution: form.category === "STUDENT" ? form.institution?.trim() : undefined,
        studentVerified: form.category === "STUDENT" ? false : undefined,
      };

      dispatch({ type: "ADD_MEMBER", payload: newMember });
      sendEmail(
        state,
        dispatch,
        form.email.trim(),
        form.name.trim(),
        "Welcome to Power Plus Gym!",
        `Hi ${form.name.trim()}, your ${plan.name} membership (${categoryLabelOf(state, form.category)} category) is active until ${newMember.expiryDate}.`,
        "welcome"
      );
      addAudit(
        dispatch,
        "Member registered",
        actor,
        `${form.name.trim()} (${nextCode}) · ${categoryLabelOf(state, form.category)} · ${plan.name}`
      );

      toast.success(`${form.name.trim()} (${nextCode}) registered and saved to database!`);
      setForm(emptyForm());
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error(err.message || "An unexpected error occurred during registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2"><Plus className="w-5 h-5 text-lime-400" /> {t("staff.registerTitle")}</h3>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t("member.categoryLabel")}</label>
          <select
            value={form.category}
            disabled={isSubmitting}
            onChange={e => {
              const category = e.target.value as CustomerCategory;
              const next = state.plans.find(p => p.active && planAppliesToCategory(p, category));
              setForm(prev => ({ ...prev, category, planId: next ? next.id : "" }));
              if (errors.planId) setErrors(prev => ({ ...prev, planId: "" }));
            }}
            data-testid="staff-category-select"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime-400/50"
          >
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabelOf(state, c)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 block mb-1">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            value={form.name}
            disabled={isSubmitting}
            onChange={e => updateField("name", e.target.value)}
            placeholder="Full name (e.g. Abebe Kebede) *"
            className={`w-full bg-zinc-800 border ${errors.name ? "border-red-500" : "border-zinc-700"} rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50`}
          />
          {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 block mb-1">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            value={form.phone}
            disabled={isSubmitting}
            onChange={e => updateField("phone", e.target.value)}
            placeholder="Phone number (e.g. 0911223344) *"
            className={`w-full bg-zinc-800 border ${errors.phone ? "border-red-500" : "border-zinc-700"} rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50`}
          />
          {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 block mb-1">
            E-mail Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            disabled={isSubmitting}
            onChange={e => updateField("email", e.target.value)}
            placeholder="E-mail address (e.g. member@gmail.com) *"
            className={`w-full bg-zinc-800 border ${errors.email ? "border-red-500" : "border-zinc-700"} rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50`}
          />
          {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
        </div>

        {form.category === "STUDENT" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Student ID <span className="text-red-400">*</span>
              </label>
              <input
                value={form.studentId}
                disabled={isSubmitting}
                onChange={e => updateField("studentId", e.target.value)}
                placeholder="Student ID number"
                className={`w-full bg-zinc-800 border ${errors.studentId ? "border-red-500" : "border-zinc-700"} rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50`}
              />
              {errors.studentId && <p className="text-xs text-red-400 mt-1">{errors.studentId}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Institution <span className="text-red-400">*</span>
              </label>
              <input
                value={form.institution}
                disabled={isSubmitting}
                onChange={e => updateField("institution", e.target.value)}
                placeholder="Institution"
                className={`w-full bg-zinc-800 border ${errors.institution ? "border-red-500" : "border-zinc-700"} rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50`}
              />
              {errors.institution && <p className="text-xs text-red-400 mt-1">{errors.institution}</p>}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-zinc-400 block mb-1">
            Membership Plan <span className="text-red-400">*</span>
          </label>
          <select
            value={form.planId}
            disabled={isSubmitting}
            onChange={e => updateField("planId", e.target.value)}
            className={`w-full bg-zinc-800 border ${errors.planId ? "border-red-500" : "border-zinc-700"} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime-400/50`}
          >
            <option value="">Choose a membership plan...</option>
            {applicablePlans.map(p => <option key={p.id} value={p.id}>{p.name} - {formatETB(p.price)}</option>)}
          </select>
          {errors.planId && <p className="text-xs text-red-400 mt-1">{errors.planId}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Emergency Contact</label>
            <input
              value={form.emergencyContact}
              disabled={isSubmitting}
              onChange={e => updateField("emergencyContact", e.target.value)}
              placeholder="Emergency contact"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Emergency Phone</label>
            <input
              value={form.emergencyPhone}
              disabled={isSubmitting}
              onChange={e => updateField("emergencyPhone", e.target.value)}
              placeholder="Emergency phone"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 block mb-1">Medical Notes (optional)</label>
          <textarea
            value={form.medicalNotes}
            disabled={isSubmitting}
            onChange={e => updateField("medicalNotes", e.target.value)}
            placeholder="Medical notes (optional)"
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 resize-none"
          />
        </div>

        <button
          onClick={handleRegister}
          disabled={isSubmitting}
          className="w-full bg-lime-400 text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-lime-300 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              <span>Saving to database...</span>
            </>
          ) : (
            <span>Register member</span>
          )}
        </button>
      </div>
    </div>
  );
}

function SteamView() {
  const { state } = useGym();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const actor = state.currentUser?.name || "Reception";
  const member = state.members.find(m => m.id === selectedId);
  const filtered = state.members.filter(m => {
    if (!search) return false;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.memberId.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2"><Drop weight="fill" className="w-5 h-5 text-cyan-400" /> Steam passes</h3>
        <div className="relative">
          <MagnifyingGlass className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => { setSearch(e.target.value); setSelectedId(""); }} placeholder="Search a member..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50" />
        </div>
        {search && !member && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(m => (
              <button key={m.id} onClick={() => { setSelectedId(m.id); setSearch(""); }} className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="font-semibold">{m.name}</span>
                <span className="text-sm text-zinc-500">{m.memberId} · <SteamActiveBadge memberId={m.id} /></span>
              </button>
            ))}
          </div>
        )}
        {search && !member && filtered.length === 0 && <p className="text-sm text-zinc-500">No member found.</p>}
        {member && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <SteamOverview memberId={member.id} />
              <SteamCheckInButton member={member} actor={actor} />
              <button onClick={() => setSelectedId("")} className="w-full bg-zinc-800 text-zinc-300 text-sm font-semibold py-2.5 rounded-xl hover:bg-zinc-700">Change member</button>
            </div>
            <SteamPurchaseForm member={member} actor={actor} />
          </div>
        )}
      </div>
    </div>
  );
}

function CommunicateView() {
  const { state, dispatch } = useGym();
  const [selectedMember, setSelectedMember] = useState("");
  const [template, setTemplate] = useState(0);
  const [customMsg, setCustomMsg] = useState("");
  const [sending, setSending] = useState(false);

  const member = state.members.find(m => m.id === selectedMember);
  const tmpl = EMAIL_TEMPLATES[template];

  const handleSend = () => {
    if (!member) { toast.error("Select a member"); return; }
    setSending(true);
    setTimeout(() => {
      const body = customMsg || (tmpl.body.replace("{name}", member.name).replace("{amount}", formatETB(member.balanceDue)).replace("{message}", "See you soon!"));
      sendEmail(state, dispatch, member.email, member.name, tmpl.subject, body, "manual");
      addAudit(dispatch, "E-mail sent", state.currentUser?.name || "Reception", `To ${member.name}: ${tmpl.subject}`);
      toast.success(`E-mail sent to ${member.name}`);
      setSending(false);
      setCustomMsg("");
    }, 800);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2"><PaperPlaneTilt className="w-5 h-5 text-lime-400" /> Send an e-mail to a member</h3>
        <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none">
          <option value="">Select a member...</option>
          {state.members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.memberId}) — {categoryLabelOf(state, m.category || "REGULAR")}</option>)}
        </select>
        <select value={template} onChange={e => setTemplate(Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none">
          {EMAIL_TEMPLATES.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
        </select>
        <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} placeholder={`Custom message (or use the template)...`} rows={4} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 resize-none" />
        {member && (
          <div className="bg-zinc-800/50 rounded-xl p-4 text-sm space-y-1">
            <div className="text-zinc-500">Preview:</div>
            <div className="font-semibold">To: {member.name} &lt;{member.email}&gt; · {categoryLabelOf(state, member.category || "REGULAR")}</div>
            <div className="font-semibold">Subject: {tmpl.subject}</div>
            <div className="text-zinc-400">{customMsg || tmpl.body.replace("{name}", member.name).replace("{amount}", formatETB(member.balanceDue)).replace("{message}", "...")}</div>
          </div>
        )}
        <button onClick={handleSend} disabled={!member || sending} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2">
          {sending ? "Sending..." : <><Envelope className="w-5 h-5" /> Send e-mail</>}
        </button>
      </div>
    </div>
  );
}