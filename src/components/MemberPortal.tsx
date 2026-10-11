import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Lightning, User, Phone, Envelope, Heart, ShieldCheck, CreditCard, CheckCircle, Calendar, Flame, GraduationCap, MoonStars, MusicNotes, Sparkle, Drop, Hourglass, Lockers, ArrowRight, ArrowClockwise, XCircle } from "@phosphor-icons/react";
import { useGym, useT, formatETB, generateId, sendEmail, addAudit, categoryLabelOf, planAppliesToCategory, memberActiveLocker } from "../context/GymContext";
import { SteamOverview, SteamPurchaseForm, SteamUsageLog, SteamReceptionPurchaseNotice } from "./SteamPanel";
import AerobicsCustomerDashboard from "./AerobicsCustomerDashboard";
import AerobicsRenewView from "./AerobicsRenewView";
import AerobicsProfileView from "./AerobicsProfileView";
import RegularCustomerDashboard from "./RegularCustomerDashboard";
import RegularRenewView from "./RegularRenewView";
import RegularProfileView from "./RegularProfileView";
import type { CustomerCategory, Member, Payment, AerobicsGroup, Trainer } from "../types";
import { fetchAerobicsDashboardData, type AerobicsDashboardState } from "../services/aerobicsDashboardService";
import { fetchRegularDashboardData, type RegularDashboardState } from "../services/regularDashboardService";
import { fetchCustomerSteamAccess, fetchCustomerSteamUsage, determinePassState, type CustomerSteamAccess, type CustomerSteamUsage } from "../services/steamService";
import SteamCustomerPurchaseCard from "./SteamCustomerPurchaseCard";
import { DEMO_CREDENTIALS } from "../constants";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<CustomerCategory, typeof Sparkle> = { REGULAR: Sparkle, STUDENT: GraduationCap, MUSLIM: MoonStars, AEROBICS: MusicNotes };
const METHOD_LABELS: Record<string, string> = { telebirr: "Telebirr", cbe_birr: "CBE Birr", cash: "Espèces", card: "Carte" };
const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50";

/**
 * TEMPORARY development bridge: maps the legacy demo regular member "m1"
 * to canonical live Regular customer PP-004 UUID (Hana Girma).
 * Isolated and easy to remove once auth-based identity resolution is in place.
 */
const REGULAR_DEMO_UUID = "11111111-1111-1111-1111-111111111104";

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr || dateStr === "—") return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function MemberPortal() {
  const { state, dispatch } = useGym();
  const t = useT();
  const [tab, setTab] = useState<"dashboard" | "renew" | "steam" | "profile" | "womens-hour">("dashboard");

  // Determine customer category session
  const currentMemberId = state.currentUser?.memberId || "";
  const isAerobicsUser =
    currentMemberId === DEMO_CREDENTIALS.member_aerobics.id ||
    currentMemberId === "m8" ||
    state.members.find(m => m.id === currentMemberId)?.category === "AEROBICS";

  const isRegularUser =
    !isAerobicsUser &&
    (currentMemberId === "m1" ||
      currentMemberId === REGULAR_DEMO_UUID ||
      state.members.find(m => m.id === currentMemberId)?.category === "REGULAR");

  // Async state for Aerobics live Supabase integration
  const [aerobicsState, setAerobicsState] = useState<AerobicsDashboardState>({ status: "loading" });
  // Async state for Regular live Supabase integration
  const [regularState, setRegularState] = useState<RegularDashboardState>({ status: "loading" });
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    if (!isAerobicsUser) return;
    let isMounted = true;
    setAerobicsState({ status: "loading" });

    // Target the live customer UUID for Aerobics
    const targetUuid = currentMemberId === "m8"
      ? DEMO_CREDENTIALS.member_aerobics.id
      : currentMemberId;

    fetchAerobicsDashboardData(targetUuid)
      .then(res => {
        if (isMounted) setAerobicsState(res);
      })
      .catch(err => {
        if (isMounted) setAerobicsState({ status: "error", error: "Failed to connect to database" });
      });

    return () => { isMounted = false; };
  }, [isAerobicsUser, currentMemberId, fetchTrigger]);

  useEffect(() => {
    if (!isRegularUser) return;
    let isMounted = true;
    setRegularState({ status: "loading" });

    // Target the live customer UUID for Regular customer via isolated bridge if legacy 'm1'
    const targetUuid = currentMemberId === "m1"
      ? REGULAR_DEMO_UUID
      : currentMemberId;

    fetchRegularDashboardData(targetUuid)
      .then(res => {
        if (isMounted) setRegularState(res);
      })
      .catch(err => {
        if (isMounted) setRegularState({ status: "error", error: "Failed to connect to database" });
      });

    return () => { isMounted = false; };
  }, [isRegularUser, currentMemberId, fetchTrigger]);

  // Synchronize currentUser.name in global state with live Supabase name for Aerobics customers
  useEffect(() => {
    if (isAerobicsUser && aerobicsState.status === "success" && state.currentUser) {
      const liveName = aerobicsState.data.customer.fullName;
      if (liveName && state.currentUser.name !== liveName) {
        dispatch({
          type: "SET_USER",
          payload: {
            ...state.currentUser,
            name: liveName,
          },
        });
      }
    }
  }, [isAerobicsUser, aerobicsState, state.currentUser, dispatch]);

  // Synchronize currentUser.name in global state with live Supabase name for Regular customers
  useEffect(() => {
    if (isRegularUser && regularState.status === "success" && state.currentUser) {
      const liveName = regularState.data.customer.fullName;
      if (liveName && state.currentUser.name !== liveName) {
        dispatch({
          type: "SET_USER",
          payload: {
            ...state.currentUser,
            name: liveName,
          },
        });
      }
    }
  }, [isRegularUser, regularState, state.currentUser, dispatch]);

  // Non-live categories: existing in-memory lookup
  const fallbackMember = state.members.find(m => m.id === currentMemberId);

  // If Aerobics user, handle async state gates
  if (isAerobicsUser) {
    if (aerobicsState.status === "loading") {
      return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-lime-400/20 border-t-lime-400 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold">Loading Aerobics Dashboard...</h2>
          <p className="text-xs text-zinc-500 mt-1">Retrieving live customer schedule and membership from Supabase</p>
        </div>
      );
    }

    if (aerobicsState.status === "error") {
      return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-md text-center">
            <XCircle weight="fill" className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2 text-white">Unable to Load Aerobics Dashboard</h2>
            <p className="text-zinc-400 text-sm mb-5">{aerobicsState.error}</p>
            <button
              onClick={() => setFetchTrigger(prev => prev + 1)}
              className="bg-lime-400 text-zinc-950 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors inline-flex items-center gap-2"
            >
              <ArrowClockwise weight="bold" className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      );
    }

    if (aerobicsState.status === "not_found") {
      return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md text-center">
            <User className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2 text-white">{t("member.noProfile")}</h2>
            <p className="text-zinc-500 text-sm">{aerobicsState.message}</p>
          </div>
        </div>
      );
    }
  } else if (isRegularUser) {
    if (regularState.status === "loading") {
      return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-lime-400/20 border-t-lime-400 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold">Loading Regular Dashboard...</h2>
          <p className="text-xs text-zinc-500 mt-1">Retrieving live customer membership and attendance from Supabase</p>
        </div>
      );
    }

    if (regularState.status === "error") {
      return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-md text-center">
            <XCircle weight="fill" className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2 text-white">Unable to Load Regular Dashboard</h2>
            <p className="text-zinc-400 text-sm mb-5">{regularState.error}</p>
            <button
              onClick={() => setFetchTrigger(prev => prev + 1)}
              className="bg-lime-400 text-zinc-950 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors inline-flex items-center gap-2"
            >
              <ArrowClockwise weight="bold" className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      );
    }

    if (regularState.status === "not_found") {
      return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md text-center">
            <User className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2 text-white">{t("member.noProfile")}</h2>
            <p className="text-zinc-500 text-sm">{regularState.message}</p>
          </div>
        </div>
      );
    }
  } else if (!fallbackMember) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t("member.noProfile")}</h2>
          <p className="text-zinc-500">{t("member.noProfileHint")}</p>
        </div>
      </div>
    );
  }

  // Map active member, plan, group, trainer, visits, etc.
  let member: Member;
  let category: CustomerCategory;
  let plan: typeof state.plans[0] | undefined;
  let group: AerobicsGroup | undefined;
  let trainer: Trainer | undefined;
  let daysRemaining: number;
  let totalDays: number;
  let progress: number;
  let visits: typeof state.visits;
  let expired: boolean;
  let countdownState: "active" | "expiring" | "expired";

  if (isAerobicsUser && aerobicsState.status === "success") {
    const { customer, membership, session, trainer: liveTrainer, attendance } = aerobicsState.data;
    category = "AEROBICS";
    member = {
      id: customer.id,
      name: customer.fullName,
      phone: customer.phone,
      email: customer.email || "",
      memberId: customer.customerCode,
      planId: membership?.plan?.id || "",
      joinDate: membership?.startDate || "—",
      expiryDate: membership?.endDate || "—",
      status: membership ? ((membership.status.toLowerCase() as any) || "active") : "expired",
      lastVisit: attendance[0]?.checkedInAt || null,
      emergencyContact: "",
      emergencyPhone: "",
      medicalNotes: "",
      emailNotifications: true,
      balanceDue: 0,
      category: "AEROBICS",
      aerobicsGroupId: customer.aerobicsGroupId || undefined,
    };

    plan = membership?.plan
      ? {
          id: membership.plan.id,
          name: membership.plan.name,
          price: membership.plan.price,
          durationDays: membership.plan.durationDays,
          perks: membership.plan.benefits ? membership.plan.benefits.split(",").map(b => b.trim()) : ["Aerobics Classes", "Dance Fitness"],
          active: true,
          applicableCategories: ["AEROBICS"],
        }
      : undefined;

    group = session
      ? {
          id: session.id,
          name: session.name,
          days: session.days,
          timeSlot: session.timeSlot,
          trainerId: session.trainerId || "",
          trainerName: liveTrainer?.fullName || "Assigned Coach",
          capacity: session.capacity,
          memberIds: [],
        }
      : undefined;

    trainer = liveTrainer
      ? {
          id: liveTrainer.id,
          name: liveTrainer.fullName,
          email: "",
          phone: liveTrainer.phone || "",
          specialties: liveTrainer.specialization ? [liveTrainer.specialization] : ["Aerobics"],
          bio: "",
          active: liveTrainer.isActive,
          clientIds: [],
          weeklyHours: 16,
        }
      : undefined;

    daysRemaining = membership ? membership.daysRemaining : 0;
    totalDays = plan?.durationDays || 30;
    progress = membership ? Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100)) : 0;
    expired = !membership || daysRemaining <= 0;
    countdownState = !membership ? "expired" : expired ? "expired" : daysRemaining <= 7 ? "expiring" : "active";

    visits = attendance.map(a => ({
      id: a.id,
      memberId: customer.id,
      timestamp: a.checkedInAt,
      checkedInBy: a.checkInMethod,
      category: "AEROBICS" as CustomerCategory,
      accessStatus: "allowed" as const,
    }));
  } else if (isRegularUser && regularState.status === "success") {
    const { customer, membership, plan: livePlan, attendance, membershipSummary } = regularState.data;
    category = "REGULAR";
    member = {
      id: customer.id,
      name: customer.fullName,
      phone: customer.phone,
      email: customer.email || "",
      memberId: customer.customerCode,
      planId: livePlan?.id || "",
      joinDate: membership?.startDate || customer.joinDate || "—",
      expiryDate: membership?.endDate || "—",
      status: (customer.status.toLowerCase() as any) || "active",
      lastVisit: attendance.lastVisit,
      emergencyContact: "",
      emergencyPhone: "",
      medicalNotes: "",
      emailNotifications: true,
      balanceDue: 0,
      category: "REGULAR",
    };

    plan = livePlan
      ? {
          id: livePlan.id,
          name: livePlan.name,
          price: livePlan.price,
          durationDays: livePlan.durationDays,
          perks: livePlan.benefits
            ? livePlan.benefits.split(",").map(b => b.trim())
            : ["Weight-room access", "Lockers & changing rooms", "Cardio machines"],
          active: livePlan.isActive,
          applicableCategories: ["REGULAR"],
        }
      : undefined;

    group = undefined;
    trainer = undefined;

    daysRemaining = membershipSummary.daysRemaining;
    totalDays = membershipSummary.durationDays || (livePlan?.durationDays || 30);
    progress = membershipSummary.progressPercent;
    expired = membershipSummary.isExpired;
    countdownState = !membership ? "expired" : expired ? "expired" : membershipSummary.isExpiring ? "expiring" : "active";

    visits = attendance.recent.map(a => ({
      id: a.id,
      memberId: customer.id,
      timestamp: a.checkedInAt,
      checkedInBy: a.checkInMethod,
      category: "REGULAR" as CustomerCategory,
      accessStatus: "allowed" as const,
    }));
  } else {
    // Standard mock data path for non-live categories (Student, Muslim, etc.)
    member = fallbackMember!;
    category = member.category || "REGULAR";
    plan = state.plans.find(p => p.id === member.planId);
    group = member.aerobicsGroupId ? state.aerobicsGroups.find(g => g.id === member.aerobicsGroupId) : undefined;
    trainer = group?.trainerId ? state.trainers.find(t => t.id === group.trainerId) : undefined;
    daysRemaining = Math.max(0, Math.ceil((new Date(member.expiryDate).getTime() - Date.now()) / 86400000));
    totalDays = plan?.durationDays || 30;
    progress = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100));
    visits = state.visits.filter(v => v.memberId === member.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    expired = new Date(member.expiryDate).getTime() < Date.now();
    countdownState = expired ? "expired" : daysRemaining <= 7 ? "expiring" : "active";
  }

  const CategoryIcon = CATEGORY_ICONS[category];
  const rules = state.accessRules.filter(r => r.category === category && r.active);
  const payments = isRegularUser && regularState.status === "success"
    ? regularState.data.payments.map(p => ({
        id: p.id,
        memberId: member.id,
        amount: p.amount,
        date: p.paidAt ? p.paidAt.split("T")[0] : (p.createdAt ? p.createdAt.split("T")[0] : "—"),
        method: (p.paymentMethod.toLowerCase() as any) || "cash",
        type: (p.serviceType.toLowerCase() as any) || "membership",
        note: p.notes || "",
      }))
    : isAerobicsUser && aerobicsState.status === "success"
    ? aerobicsState.data.payments.map(p => ({
        id: p.id,
        memberId: member.id,
        amount: p.amount,
        date: p.paidAt ? p.paidAt.split("T")[0] : (p.createdAt ? p.createdAt.split("T")[0] : "—"),
        method: (p.paymentMethod.toLowerCase() as any) || "cash",
        type: (p.serviceType.toLowerCase() as any) || "membership",
        note: p.notes || "",
      }))
    : state.payments.filter(p => p.memberId === member.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const myLocker = isRegularUser && regularState.status === "success"
    ? regularState.data.locker
    : isAerobicsUser && aerobicsState.status === "success"
    ? aerobicsState.data.locker
    : memberActiveLocker(state, member.id);
  const steamLeft = state.steamAccess
    .filter(s => s.customerId === member.id && new Date(s.endDate).getTime() >= Date.now() && s.remainingVisits > 0)
    .reduce((sum, s) => sum + s.remainingVisits, 0);
  const locale = state.language === "am" ? "am-ET" : "en-US";

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <ShieldCheck weight="fill" className="w-6 h-6 text-lime-400" />
          <h1 className="text-2xl font-black uppercase tracking-tight">{t("member.title")}</h1>
        </div>
        {(() => {
          const eligibleForWomensHour = category === "MUSLIM";
          const tabs: ("dashboard" | "renew" | "steam" | "profile" | "womens-hour")[] = [
            "dashboard",
            "renew",
            "steam",
            "profile",
            ...(eligibleForWomensHour ? ["womens-hour" as const] : []),
          ];
          return (
            <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
              {tabs.map(key => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    tab === key ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {t(`member.tab.${key}`)}
                </button>
              ))}
            </div>
          );
        })()}

        {tab === "dashboard" && (
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} relative overflow-hidden`}>
              <div className={`absolute inset-0 opacity-[0.07] pointer-events-none bg-gradient-to-br ${countdownState === "expired" ? "from-red-400" : countdownState === "expiring" ? "from-yellow-400" : "from-lime-400"} to-transparent`} />
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h2 className="text-xl font-bold">{member.name}</h2>
                    {isRegularUser && regularState.status === "success" && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-800 text-lime-400 border border-lime-400/20">
                        {regularState.data.customer.status.toUpperCase()}
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${countdownState === "active" ? "bg-lime-400/20 text-lime-400" : countdownState === "expiring" ? "bg-yellow-400/20 text-yellow-400" : "bg-red-400/20 text-red-400"}`}>{t(`countdown.${countdownState}`)}</span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300">
                      <CategoryIcon weight="fill" className="w-3.5 h-3.5 text-lime-400" />{categoryLabelOf(state, category)}
                    </span>
                    {myLocker && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-400">
                        <Lockers weight="fill" className="w-3.5 h-3.5" />{t("staff.lockerHeld", { n: myLocker.locker.number })}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-sm">{member.memberId} · {t("member.memberSince", { date: formatDateDisplay(member.joinDate) })}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
                    <span className="text-zinc-400">{t("countdown.plan")}: <span className="text-white font-semibold">{plan?.name || "No Plan"}</span></span>
                    {plan?.price != null && (
                      <span className="text-zinc-400">Price: <span className="text-lime-400 font-semibold">{plan.price} ETB</span></span>
                    )}
                    {member.joinDate && member.joinDate !== "—" && (
                      <span className="text-zinc-400">Start: <span className="text-white font-semibold">{formatDateDisplay(member.joinDate)}</span></span>
                    )}
                    {member.expiryDate && member.expiryDate !== "—" && (
                      <span className="text-zinc-400">End: <span className="text-white font-semibold">{formatDateDisplay(member.expiryDate)}</span></span>
                    )}
                    <span className="text-zinc-400">{t("countdown.steamLeft")}: <span className="text-cyan-400 font-semibold">{steamLeft}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <Hourglass weight="fill" className={`w-6 h-6 mx-auto mb-1 ${countdownState === "active" ? "text-lime-400" : countdownState === "expiring" ? "text-yellow-400" : "text-red-400"}`} />
                    <div className="text-[11px] uppercase tracking-wide text-zinc-500">{countdownState === "expired" ? t("countdown.expired") : daysRemaining === 1 ? t("countdown.dayLeft", { n: daysRemaining }) : t("countdown.daysLeft", { n: daysRemaining })}</div>
                  </div>
                  <div className={`text-5xl md:text-6xl font-black tabular-nums ${countdownState === "active" ? "text-lime-400" : countdownState === "expiring" ? "text-yellow-400" : "text-red-400"}`}>{daysRemaining}</div>
                </div>
              </div>
              <div className="relative mt-5 bg-zinc-800 rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${countdownState === "expired" ? "bg-red-400" : countdownState === "expiring" ? "bg-gradient-to-r from-yellow-400 to-amber-300" : "bg-gradient-to-r from-lime-400 to-lime-300"}`} style={{ width: `${progress}%` }} />
              </div>
              <div className="relative flex justify-between items-center mt-3 text-xs text-zinc-500">
                <span>{t("countdown.used", { pct: Math.round(progress) })}</span>
                <span>{expired ? t("countdown.expired") : t("countdown.expiresOn", { date: formatDateDisplay(member.expiryDate) })}</span>
              </div>
              <button onClick={() => setTab("renew")} className="relative mt-4 w-full sm:w-auto bg-lime-400 text-zinc-950 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2">
                <ArrowRight weight="bold" className="w-4 h-4" /> {t("countdown.renewNow")}
              </button>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: t("member.lastVisit"),
                  value: member.lastVisit ? new Date(member.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
                  sub: member.lastVisit ? new Date(member.lastVisit).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : undefined,
                  icon: Calendar,
                },
                {
                  label: t("member.totalVisits"),
                  value: isRegularUser && regularState.status === "success"
                    ? String(regularState.data.attendance.total)
                    : isAerobicsUser && aerobicsState.status === "success"
                    ? String(aerobicsState.data.attendanceTotal)
                    : String(visits.length),
                  icon: Flame,
                },
                {
                  label: t("member.payments"),
                  value: String(payments.length),
                  icon: CreditCard,
                },
                {
                  label: isRegularUser ? "Balance Due" : t("member.balanceDue"),
                  value: isRegularUser ? "—" : formatETB(member.balanceDue),
                  icon: Lightning,
                },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <s.icon weight="fill" className="w-6 h-6 text-lime-400 mx-auto mb-2" />
                  <div className="text-lg font-black">{s.value}</div>
                  {s.sub && <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{s.sub}</div>}
                  <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
                </motion.div>
              ))}
            </div>

            <div className={CARD}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Lockers weight="fill" className="w-5 h-5 text-amber-400" /> {t("member.myLocker")}</h3>
              {myLocker ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-zinc-800/50 rounded-xl p-3">
                    <div className="text-xs text-zinc-500">{t("locker.number")}</div>
                    <div className="font-black text-white text-lg">{myLocker.locker.number}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-3">
                    <div className="text-xs text-zinc-500">{t("locker.section")}</div>
                    <div className="font-semibold text-white">{t(`locker.section.${myLocker.locker.section}`)}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-3">
                    <div className="text-xs text-zinc-500">{t("locker.keyTag")}</div>
                    <div className="font-semibold text-white">{myLocker.locker.keyTag || "—"}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-3">
                    <div className="text-xs text-zinc-500">{t("locker.issuedAt")}</div>
                    <div className="font-semibold text-white">{new Date(myLocker.assignment.assignedAt).toLocaleDateString(locale)}</div>
                  </div>
                  {myLocker.assignment.dueDate && (
                    <div className="bg-zinc-800/50 rounded-xl p-3">
                      <div className="text-xs text-zinc-500">{t("locker.dueDate")}</div>
                      <div className="font-semibold text-white">{new Date(myLocker.assignment.dueDate).toLocaleDateString(locale)}</div>
                    </div>
                  )}
                  <div className="bg-zinc-800/50 rounded-xl p-3">
                    <div className="text-xs text-zinc-500">{t("locker.status")}</div>
                    <div className="font-semibold text-amber-400">{t("locker.status.IN_USE")}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{t("member.noLocker")}</p>
              )}
            </div>

            {category === "AEROBICS" ? (
              <AerobicsCustomerDashboard
                member={member}
                group={group}
                trainer={trainer}
                occupancy={isAerobicsUser && aerobicsState.status === "success" ? (aerobicsState.data.occupancy ?? undefined) : undefined}
              />
            ) : category === "REGULAR" ? (
              <RegularCustomerDashboard
                member={member}
                membershipSummary={isRegularUser && regularState.status === "success" ? regularState.data.membershipSummary : undefined}
                attendance={isRegularUser && regularState.status === "success" ? regularState.data.attendance : undefined}
                payments={isRegularUser && regularState.status === "success" ? regularState.data.payments : undefined}
                onRenew={() => setTab("renew")}
              />
            ) : (
              <div className={CARD}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><CategoryIcon weight="fill" className="w-5 h-5 text-lime-400" /> {t("member.category")} : {categoryLabelOf(state, category)}</h3>
                <div className="space-y-1">
                  {rules.map(r => (
                    <div key={r.id} className="text-sm text-zinc-400 flex items-start gap-2"><Clock className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" /><span>{r.startTime} – {r.endTime} · {r.days.join(", ")}</span></div>
                  ))}
                  {rules.length === 0 && <p className="text-sm text-zinc-500">—</p>}
                </div>
                {category === "STUDENT" && (
                  <div className="mt-4 bg-zinc-800/50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Student ID</span><span>{member.studentId || "Not provided"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Institution</span><span>{member.institution || "Not provided"}</span></div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Student rate</span>
                      <span className={member.studentVerified ? "text-lime-400 font-semibold" : "text-yellow-400 font-semibold"}>{member.studentVerified ? "Verified" : "Awaiting verification at reception"}</span>
                    </div>
                    <p className="text-xs text-zinc-500">Show your student card at reception to activate the reduced rate.</p>
                  </div>
                )}
                <p className="text-xs text-zinc-600 mt-3">Only reception or the owner can change your category.</p>
              </div>
            )}

            {plan && (
              <div className={CARD}>
                <h3 className="font-bold mb-3">{t("member.perks")} ({plan.name})</h3>
                <div className="flex flex-wrap gap-2">
                  {plan.perks.map(p => <span key={p} className="bg-lime-400/10 border border-lime-400/20 text-lime-400 px-3 py-1.5 rounded-full text-sm flex items-center gap-1"><CheckCircle weight="fill" className="w-3 h-3" />{p}</span>)}
                </div>
              </div>
            )}

            <div className={CARD}>
              <h3 className="font-bold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-lime-400" /> {t("member.recentVisits")}</h3>
              {visits.length === 0 ? <p className="text-zinc-500 text-sm">{t("member.noVisits")}</p> : (
                <div className="space-y-2">
                  {visits.slice(0, 10).map(v => (
                    <div key={v.id} className="flex justify-between items-center py-2 border-b border-zinc-800/50 text-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${v.accessStatus === "denied" ? "bg-red-400" : "bg-lime-400"}`} />
                        <span>{new Date(v.timestamp).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}</span>
                      </div>
                      <span className="text-zinc-500">{new Date(v.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={CARD}>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-lime-400" />
                {t("member.payments")}
              </h3>
              {payments.length === 0 ? (
                <div className="py-4 text-center text-zinc-500 text-sm">
                  <p>No membership payments recorded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.slice(0, 10).map(p => (
                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-zinc-800/50 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-300 font-medium">{p.date}</span>
                        <span className="text-zinc-500 text-xs">{METHOD_LABELS[p.method] || p.method}</span>
                      </div>
                      <span className="text-lime-400 font-bold">{formatETB(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "renew" && (
          isAerobicsUser ? (
            <AerobicsRenewView customerId={member.id} />
          ) : isRegularUser ? (
            <RegularRenewView customerId={member.id} />
          ) : (
            <RenewView member={member} category={category} />
          )
        )}
        {tab === "steam" && (
          isAerobicsUser || isRegularUser ? (
            <CustomerSteamView
              customerId={member.id}
              customerCode={member.memberId}
              customerName={member.name}
            />
          ) : (
            <SteamView member={member} />
          )
        )}
        {tab === "profile" && (
          isAerobicsUser ? (
            <AerobicsProfileView
              customerId={member.id}
              onProfileUpdated={() => setFetchTrigger(prev => prev + 1)}
            />
          ) : isRegularUser ? (
            <RegularProfileView
              customerId={member.id}
              onProfileUpdated={() => setFetchTrigger(prev => prev + 1)}
            />
          ) : (
            <ProfileView member={member} category={category} />
          )
        )}
        {tab === "womens-hour" && (
          category === "MUSLIM" ? (
            <WomensHourView
              member={member}
              rules={rules}
              trainers={state.trainers.filter(trainer => trainer.active)}
            />
          ) : (
            <UnauthorizedWomensHourView />
          )
        )}
      </div>
    </div>
  );
}

function RenewView({ member, category }: { member: Member; category: CustomerCategory }) {
  const { state, dispatch } = useGym();
  const t = useT();
  const eligiblePlans = state.plans.filter(p => p.active && planAppliesToCategory(p, category));
  const [selectedPlan, setSelectedPlan] = useState(eligiblePlans.some(p => p.id === member.planId) ? member.planId : eligiblePlans[0]?.id || "");
  const [method, setMethod] = useState<Payment["method"]>("telebirr");
  const [processing, setProcessing] = useState(false);
  const plan = eligiblePlans.find(p => p.id === selectedPlan);

  const handleRenew = () => {
    if (!plan) { toast.error(t("member.noPlans")); return; }
    setProcessing(true);
    setTimeout(() => {
      const payment: Payment = { id: generateId("pay"), memberId: member.id, amount: plan.price, date: new Date().toISOString().split("T")[0], method, type: "renewal", note: `Renewal ${plan.name}` };
      dispatch({ type: "ADD_PAYMENT", payload: payment });
      const newExpiry = new Date(Date.now() + plan.durationDays * 86400000).toISOString().split("T")[0];
      dispatch({ type: "UPDATE_MEMBER", payload: { ...member, planId: selectedPlan, expiryDate: newExpiry, status: "active", balanceDue: 0 } });
      sendEmail(state, dispatch, member.email, member.name, `Payment receipt - ${formatETB(plan.price)}`, `Hi ${member.name}, we have received ${formatETB(plan.price)} via ${METHOD_LABELS[method]}. Your ${plan.name} plan is renewed until ${newExpiry}.`, "receipt");
      addAudit(dispatch, "Renewal", member.name, `${plan.name} · ${METHOD_LABELS[method]} · ${categoryLabelOf(state, category)}`);
      toast.success(t("member.renewSuccess", { plan: plan.name, date: newExpiry }));
      setProcessing(false);
    }, 1500);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className={`${CARD} space-y-4`}>
        <h3 className="font-bold text-lg flex items-center gap-2"><CreditCard className="w-5 h-5 text-lime-400" /> {t("member.renewTitle")}</h3>
        <p className="text-sm text-zinc-500">{t("member.renewHint")} <span className="text-lime-400 font-semibold">{categoryLabelOf(state, category)}</span>.</p>
        {eligiblePlans.length === 0 ? (
          <p className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3">{t("member.noPlans")}</p>
        ) : (
          <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} className={INPUT}>
            {eligiblePlans.map(p => <option key={p.id} value={p.id}>{p.name} - {formatETB(p.price)} ({t("locker.days", { n: p.durationDays })})</option>)}
          </select>
        )}
        <div>
          <label className="text-xs text-zinc-500 block mb-2">{t("member.paymentMethod")}</label>
          <div className="grid grid-cols-2 gap-2">
            {(["telebirr", "cbe_birr", "cash", "card"] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)} className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${method === m ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{METHOD_LABELS[m]}</button>
            ))}
          </div>
        </div>
        {plan && (
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">{t("member.plan")}</span><span className="font-semibold">{plan.name}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{t("member.duration")}</span><span className="font-semibold">{t("locker.days", { n: plan.durationDays })}</span></div>
            <div className="flex justify-between border-t border-zinc-700 pt-2"><span className="text-zinc-400">{t("member.total")}</span><span className="font-black text-lime-400 text-lg">{formatETB(plan.price)}</span></div>
          </div>
        )}
        <button onClick={handleRenew} disabled={processing || !plan} className="w-full bg-lime-400 text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-lime-300 transition-colors disabled:opacity-50 active:scale-[0.98]">
          {processing ? t("member.processing") : t("member.pay", { amount: plan ? formatETB(plan.price) : "" })}
        </button>
      </div>
    </div>
  );
}

function CustomerSteamView({
  customerId,
  customerCode,
  customerName,
}: {
  customerId: string;
  customerCode?: string;
  customerName?: string;
}) {
  const { state } = useGym();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<CustomerSteamAccess[]>([]);
  const [usageLogs, setUsageLogs] = useState<CustomerSteamUsage[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accessRes, usageRes] = await Promise.all([
        fetchCustomerSteamAccess(customerId),
        fetchCustomerSteamUsage(customerId),
      ]);

      if (accessRes.error) {
        setError(accessRes.error);
        setLoading(false);
        return;
      }

      setPasses(accessRes.data);
      setUsageLogs(usageRes.data);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || "Unable to load Steam information. Please try again.");
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!state.settings.steamEnabled) {
    return (
      <div className="max-w-lg mx-auto">
        <div className={`${CARD} text-center`}>
          <Drop weight="fill" className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">{t("member.steamUnavailable")}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center text-zinc-400">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full mb-3" />
        <p className="text-sm font-medium">Loading Steam access...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <div className={`${CARD} text-center space-y-3`}>
          <XCircle className="w-8 h-8 text-red-400 mx-auto" />
          <div className="font-bold text-red-300">Unable to load Steam information.</div>
          <p className="text-xs text-zinc-400">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-xs font-semibold hover:bg-zinc-700 transition"
          >
            Please try again
          </button>
        </div>
      </div>
    );
  }

  const activePass = passes.find(p => determinePassState(p) === "Active") || null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <SteamOverview memberId={customerId} livePasses={passes} />
      <SteamCustomerPurchaseCard
        customerId={customerId}
        customerCode={customerCode}
        customerName={customerName}
        hasActivePass={Boolean(activePass)}
        activePassRemainingVisits={activePass?.remainingVisits ?? 0}
        onPurchaseSubmitted={loadData}
      />
      <SteamUsageLog memberId={customerId} liveUsage={usageLogs} />
    </div>
  );
}

function SteamView({ member }: { member: Member }) {
  const { state } = useGym();
  const t = useT();
  if (!state.settings.steamEnabled) {
    return (
      <div className="max-w-lg mx-auto">
        <div className={`${CARD} text-center`}>
          <Drop weight="fill" className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">{t("member.steamUnavailable")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <SteamOverview memberId={member.id} />
      <SteamPurchaseForm member={member} actor={member.name} />
      <SteamUsageLog memberId={member.id} />
    </div>
  );
}

function ProfileView({ member, category }: { member: Member; category: CustomerCategory }) {
  const { state, dispatch } = useGym();
  const t = useT();
  const [form, setForm] = useState({ name: member.name, phone: member.phone, email: member.email, emergencyContact: member.emergencyContact, emergencyPhone: member.emergencyPhone, medicalNotes: member.medicalNotes, emailNotifications: member.emailNotifications });

  const handleSave = () => {
    dispatch({ type: "UPDATE_MEMBER", payload: { ...member, ...form } });
    addAudit(dispatch, "Profile updated", member.name, "Contact details and emergency contact updated");
    toast.success(t("member.profileSaved"));
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className={`${CARD} space-y-4`}>
        <h3 className="font-bold text-lg flex items-center gap-2"><User className="w-5 h-5 text-lime-400" /> {t("member.profileTitle")}</h3>
        <div className="flex justify-between items-center bg-zinc-800/50 rounded-xl px-4 py-3 text-sm">
          <span className="text-zinc-400">{t("member.categoryLabel")}</span>
          <span className="font-semibold text-lime-400">{categoryLabelOf(state, category)}</span>
        </div>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t("common.name")} className={INPUT} />
        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder={t("common.phone")} className={INPUT} />
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t("common.email")} className={INPUT} />
        <div className="grid grid-cols-2 gap-3">
          <input value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} placeholder={t("common.emergencyContact")} className={INPUT} />
          <input value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} placeholder={t("common.emergencyPhone")} className={INPUT} />
        </div>
        <textarea value={form.medicalNotes} onChange={e => setForm({ ...form, medicalNotes: e.target.value })} placeholder={t("common.medicalNotes")} rows={2} className={`${INPUT} resize-none`} />
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.emailNotifications} onChange={e => setForm({ ...form, emailNotifications: e.target.checked })} className="w-5 h-5 accent-lime-400" />
          <span className="text-sm">{t("member.enableEmails")}</span>
        </label>
        <button onClick={handleSave} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300 transition-colors active:scale-[0.98]">{t("member.saveProfile")}</button>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-lime-400" /> {t("member.payments")}</h3>
        <div className="space-y-2">
          {state.payments.filter(p => p.memberId === member.id).slice().reverse().map(p => (
            <div key={p.id} className="flex justify-between items-center text-sm border-b border-zinc-800/50 py-2">
              <span className="text-zinc-400">{p.date} · {METHOD_LABELS[p.method] || p.method}</span>
              <span className="text-lime-400 font-semibold">{formatETB(p.amount)}</span>
            </div>
          ))}
          {state.payments.filter(p => p.memberId === member.id).length === 0 && <p className="text-zinc-500 text-sm">{t("member.noPayments")}</p>}
        </div>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Envelope className="w-5 h-5 text-lime-400" /> {t("common.myEmails")}</h3>
        <div className="space-y-2">
          {state.emailLogs.filter(e => e.to === member.email).slice().reverse().slice(0, 5).map(e => (
            <div key={e.id} className="text-sm border-l-2 border-zinc-700 pl-3 py-1">
              <div className="font-semibold">{e.subject}</div>
              <div className="text-xs text-zinc-500">{new Date(e.sentAt).toLocaleString("en-US")}</div>
            </div>
          ))}
          {state.emailLogs.filter(e => e.to === member.email).length === 0 && <p className="text-zinc-500 text-sm">{t("common.noEmails")}</p>}
        </div>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Heart weight="fill" className="w-5 h-5 text-lime-400" /> {t("common.help")}</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-lime-400" /> {state.settings.phone}</div>
          <div className="flex items-center gap-2"><Envelope className="w-4 h-4 text-lime-400" /> {state.settings.email}</div>
        </div>
      </div>
    </div>
  );
}

function WomensHourView({
  member,
  rules,
  trainers,
}: {
  member: Member;
  rules: { id: string; startTime: string; endTime: string; days: string[]; description: string }[];
  trainers: { id: string; name: string; specialties: string[]; bio?: string }[];
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className={`${CARD} border-lime-400/30`}>
        <div className="flex items-start gap-4">
          <MoonStars weight="fill" className="w-10 h-10 text-lime-400 shrink-0" />
          <div>
            <h2 className="text-2xl font-black">Women's Hour</h2>
            <p className="text-sm text-zinc-400 mt-2">
              A designated gym access area for members registered under the Women's Hours (Muslim) option.
            </p>
          </div>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-lime-400/15 px-3 py-1.5 text-sm font-semibold text-lime-400">
          <CheckCircle weight="fill" className="w-4 h-4" /> Eligible member
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-lime-400" /> Schedule
        </h3>
        {rules.length === 0 ? (
          <p className="text-sm text-zinc-500">No Women's Hour schedule is configured.</p>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-semibold text-white">{rule.days.join(", ")}</span>
                  <span className="text-lime-400 font-semibold">{rule.startTime} - {rule.endTime}</span>
                </div>
                {rule.description && <p className="text-xs text-zinc-500 mt-2">{rule.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={CARD}>
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-lime-400" /> Your member information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-zinc-500 block">Name</span><span>{member.name}</span></div>
          <div><span className="text-zinc-500 block">Member ID</span><span>{member.memberId}</span></div>
          <div><span className="text-zinc-500 block">Phone</span><span>{member.phone || "—"}</span></div>
          <div><span className="text-zinc-500 block">Email</span><span>{member.email || "—"}</span></div>
        </div>
      </div>
      <div className={CARD}>
        <h3 className="font-bold mb-4">Training team</h3>
        {trainers.length === 0 ? (
          <p className="text-sm text-zinc-500">No active trainers are currently listed.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trainers.map(trainer => (
              <div key={trainer.id} className="bg-zinc-800/50 rounded-xl p-4">
                <div className="font-semibold">{trainer.name}</div>
                <div className="text-xs text-lime-400 mt-1">{trainer.specialties.join(" · ")}</div>
                {trainer.bio && <p className="text-xs text-zinc-500 mt-2">{trainer.bio}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UnauthorizedWomensHourView() {
  return (
    <div className={`${CARD} max-w-lg mx-auto text-center`}>
      <ShieldCheck className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
      <h2 className="text-xl font-bold">Women's Hour unavailable</h2>
      <p className="text-sm text-zinc-500 mt-2">This area is available only to eligible members.</p>
    </div>
  );
}