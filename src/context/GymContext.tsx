import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { Member, Plan, Payment, Expense, Visit, EmailLog, StaffUser, GymSettings, AuditLog, AuthUser, MemberStatus, Trainer, GymClass, ClassAttendee, TrainerClientNote, CustomerCategory, AccessRule, AerobicsGroup, CategoryLabel, AccessDecision, SteamAccess, SteamUsage, SteamStatus, SteamType, Language, Locker, LockerAssignment } from "../types";
import { MEMBERS, PLANS, PAYMENTS, EXPENSES, VISITS, EMAIL_LOGS, STAFF, DEFAULT_SETTINGS, AUDIT_LOGS, TRAINERS, CLASSES, CLASS_ATTENDEES, TRAINER_CLIENT_NOTES, ACCESS_RULES, AEROBICS_GROUPS, CATEGORY_LABELS, WEEK_DAYS, ALL_DAYS, STEAM_ACCESS, STEAM_USAGE, LOCKERS, LOCKER_ASSIGNMENTS } from "../constants";
import { DEFAULT_LANGUAGE, translate } from "../i18n/translations";

export interface State {
  members: Member[];
  plans: Plan[];
  payments: Payment[];
  expenses: Expense[];
  visits: Visit[];
  emailLogs: EmailLog[];
  staff: StaffUser[];
  settings: GymSettings;
  auditLogs: AuditLog[];
  trainers: Trainer[];
  classes: GymClass[];
  classAttendees: ClassAttendee[];
  trainerNotes: TrainerClientNote[];
  accessRules: AccessRule[];
  aerobicsGroups: AerobicsGroup[];
  categoryLabels: CategoryLabel[];
  steamAccess: SteamAccess[];
  steamUsage: SteamUsage[];
  language: Language;
  lockers: Locker[];
  lockerAssignments: LockerAssignment[];
  currentUser: AuthUser | null;
}

type Action =
  | { type: "SET_USER"; payload: AuthUser | null }
  | { type: "ADD_MEMBER"; payload: Member }
  | { type: "UPDATE_MEMBER"; payload: Member }
  | { type: "DELETE_MEMBER"; payload: string }
  | { type: "ADD_PLAN"; payload: Plan }
  | { type: "UPDATE_PLAN"; payload: Plan }
  | { type: "DELETE_PLAN"; payload: string }
  | { type: "ADD_PAYMENT"; payload: Payment }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "ADD_VISIT"; payload: Visit }
  | { type: "ADD_EMAIL_LOG"; payload: EmailLog }
  | { type: "UPDATE_SETTINGS"; payload: GymSettings }
  | { type: "ADD_AUDIT"; payload: AuditLog }
  | { type: "ADD_STAFF"; payload: StaffUser }
  | { type: "UPDATE_STAFF"; payload: StaffUser }
  | { type: "TOGGLE_ATTENDANCE"; payload: { classId: string; memberId: string } }
  | { type: "ADD_TRAINER_NOTE"; payload: TrainerClientNote }
  | { type: "ADD_CLASS"; payload: GymClass }
  | { type: "UPDATE_CLASS"; payload: GymClass }
  | { type: "DELETE_CLASS"; payload: string }
  | { type: "ADD_ACCESS_RULE"; payload: AccessRule }
  | { type: "UPDATE_ACCESS_RULE"; payload: AccessRule }
  | { type: "DELETE_ACCESS_RULE"; payload: string }
  | { type: "ADD_AEROBICS_GROUP"; payload: AerobicsGroup }
  | { type: "UPDATE_AEROBICS_GROUP"; payload: AerobicsGroup }
  | { type: "DELETE_AEROBICS_GROUP"; payload: string }
  | { type: "UPDATE_CATEGORY_LABEL"; payload: CategoryLabel }
  | { type: "SET_STUDENT_VERIFICATION"; payload: { memberId: string; verified: boolean; verifiedBy: string } }
  | { type: "ADD_STEAM_ACCESS"; payload: SteamAccess }
  | { type: "UPDATE_STEAM_ACCESS"; payload: SteamAccess }
  | { type: "ADD_STEAM_USAGE"; payload: SteamUsage }
  | { type: "SET_LANGUAGE"; payload: Language }
  | { type: "ADD_LOCKER"; payload: Locker }
  | { type: "ADD_LOCKERS"; payload: Locker[] }
  | { type: "UPDATE_LOCKER"; payload: Locker }
  | { type: "DELETE_LOCKER"; payload: string }
  | { type: "ADD_LOCKER_ASSIGNMENT"; payload: LockerAssignment }
  | { type: "UPDATE_LOCKER_ASSIGNMENT"; payload: LockerAssignment };

const getInitialUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("powerplus_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const initialState: State = {
  members: MEMBERS,
  plans: PLANS,
  payments: PAYMENTS,
  expenses: EXPENSES,
  visits: VISITS,
  emailLogs: EMAIL_LOGS,
  staff: STAFF,
  settings: DEFAULT_SETTINGS,
  auditLogs: AUDIT_LOGS,
  trainers: TRAINERS,
  classes: CLASSES,
  classAttendees: CLASS_ATTENDEES,
  trainerNotes: TRAINER_CLIENT_NOTES,
  accessRules: ACCESS_RULES,
  aerobicsGroups: AEROBICS_GROUPS,
  categoryLabels: CATEGORY_LABELS,
  steamAccess: STEAM_ACCESS,
  steamUsage: STEAM_USAGE,
  language: DEFAULT_LANGUAGE,
  lockers: LOCKERS,
  lockerAssignments: LOCKER_ASSIGNMENTS,
  currentUser: getInitialUser(),
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER": {
      if (typeof window !== "undefined") {
        try {
          if (action.payload) {
            localStorage.setItem("powerplus_current_user", JSON.stringify(action.payload));
          } else {
            localStorage.removeItem("powerplus_current_user");
          }
        } catch {
          // ignore storage errors
        }
      }
      return { ...state, currentUser: action.payload };
    }
    case "ADD_MEMBER": return { ...state, members: [...state.members, action.payload] };
    case "UPDATE_MEMBER": return { ...state, members: state.members.map(m => m.id === action.payload.id ? action.payload : m) };
    case "DELETE_MEMBER": return { ...state, members: state.members.filter(m => m.id !== action.payload) };
    case "ADD_PLAN": return { ...state, plans: [...state.plans, action.payload] };
    case "UPDATE_PLAN": return { ...state, plans: state.plans.map(p => p.id === action.payload.id ? action.payload : p) };
    case "DELETE_PLAN": return { ...state, plans: state.plans.filter(p => p.id !== action.payload) };
    case "ADD_PAYMENT": return { ...state, payments: [...state.payments, action.payload] };
    case "ADD_EXPENSE": return { ...state, expenses: [...state.expenses, action.payload] };
    case "ADD_VISIT": return { ...state, visits: [...state.visits, action.payload] };
    case "ADD_EMAIL_LOG": return { ...state, emailLogs: [...state.emailLogs, action.payload] };
    case "UPDATE_SETTINGS": return { ...state, settings: action.payload };
    case "ADD_AUDIT": return { ...state, auditLogs: [...state.auditLogs, action.payload] };
    case "ADD_STAFF": return { ...state, staff: [...state.staff, action.payload] };
    case "UPDATE_STAFF": return { ...state, staff: state.staff.map(s => s.id === action.payload.id ? action.payload : s) };
    case "TOGGLE_ATTENDANCE": return { ...state, classAttendees: state.classAttendees.map(a => a.classId === action.payload.classId && a.memberId === action.payload.memberId ? { ...a, attended: !a.attended } : a) };
    case "ADD_TRAINER_NOTE": return { ...state, trainerNotes: [action.payload, ...state.trainerNotes] };
    case "ADD_CLASS": return { ...state, classes: [...state.classes, action.payload] };
    case "UPDATE_CLASS": return { ...state, classes: state.classes.map(c => c.id === action.payload.id ? action.payload : c) };
    case "DELETE_CLASS": return { ...state, classes: state.classes.filter(c => c.id !== action.payload) };
    case "ADD_ACCESS_RULE": return { ...state, accessRules: [...state.accessRules, action.payload] };
    case "UPDATE_ACCESS_RULE": return { ...state, accessRules: state.accessRules.map(r => r.id === action.payload.id ? action.payload : r) };
    case "DELETE_ACCESS_RULE": return { ...state, accessRules: state.accessRules.filter(r => r.id !== action.payload) };
    case "ADD_AEROBICS_GROUP": return { ...state, aerobicsGroups: [...state.aerobicsGroups, action.payload] };
    case "UPDATE_AEROBICS_GROUP": return { ...state, aerobicsGroups: state.aerobicsGroups.map(g => g.id === action.payload.id ? action.payload : g) };
    case "DELETE_AEROBICS_GROUP": return { ...state, aerobicsGroups: state.aerobicsGroups.filter(g => g.id !== action.payload) };
    case "UPDATE_CATEGORY_LABEL": return { ...state, categoryLabels: state.categoryLabels.map(c => c.category === action.payload.category ? action.payload : c) };
    case "SET_STUDENT_VERIFICATION": return {
      ...state,
      members: state.members.map(m => m.id === action.payload.memberId
        ? { ...m, studentVerified: action.payload.verified, verifiedBy: action.payload.verified ? action.payload.verifiedBy : undefined, verifiedAt: action.payload.verified ? new Date().toISOString().split("T")[0] : undefined }
        : m),
    };
    case "ADD_STEAM_ACCESS": return { ...state, steamAccess: [...state.steamAccess, action.payload] };
    case "UPDATE_STEAM_ACCESS": return { ...state, steamAccess: state.steamAccess.map(s => s.id === action.payload.id ? action.payload : s) };
    case "ADD_STEAM_USAGE": return { ...state, steamUsage: [action.payload, ...state.steamUsage] };
    case "SET_LANGUAGE": return { ...state, language: action.payload };
    case "ADD_LOCKER": return { ...state, lockers: [...state.lockers, action.payload] };
    case "ADD_LOCKERS": return { ...state, lockers: [...state.lockers, ...action.payload] };
    case "UPDATE_LOCKER": return { ...state, lockers: state.lockers.map(l => l.id === action.payload.id ? action.payload : l) };
    case "DELETE_LOCKER": return { ...state, lockers: state.lockers.filter(l => l.id !== action.payload) };
    case "ADD_LOCKER_ASSIGNMENT": return { ...state, lockerAssignments: [action.payload, ...state.lockerAssignments] };
    case "UPDATE_LOCKER_ASSIGNMENT": return { ...state, lockerAssignments: state.lockerAssignments.map(a => a.id === action.payload.id ? action.payload : a) };
    default: return state;
  }
}

const GymContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function GymProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <GymContext.Provider value={{ state, dispatch }}>{children}</GymContext.Provider>;
}

export function useGym() {
  const ctx = useContext(GymContext);
  if (!ctx) throw new Error("useGym must be inside GymProvider");
  return ctx;
}

export function computeMemberStatus(member: Member, settings: GymSettings): MemberStatus {
  const now = new Date();
  const expiry = new Date(member.expiryDate);
  const lastVisit = member.lastVisit ? new Date(member.lastVisit) : null;
  if (expiry < now) return "expired";
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (daysUntilExpiry <= 7) return "expiring";
  if (lastVisit) {
    const daysSinceVisit = Math.floor((now.getTime() - lastVisit.getTime()) / 86400000);
    if (daysSinceVisit >= settings.inactivityThresholdDays) return "inactive";
  }
  return "active";
}

/* ----------------------------- Phase 2 ----------------------------- */

/** English day name of a date (Monday-first week). */
export function dayName(date: Date): string {
  return WEEK_DAYS[(date.getDay() + 6) % 7];
}

export function toMinutes(time: string): number {
  const parts = time.split(":");
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
}

/** Checks that a member complies with their category access rules at the given time. */
export function evaluateAccess(member: Member, rules: AccessRule[], at: Date = new Date()): AccessDecision {
  const category = member.category || "REGULAR";
  const day = dayName(at);
  const minutes = at.getHours() * 60 + at.getMinutes();
  const catRules = rules.filter(r => r.active && r.category === category);
  if (catRules.length === 0) {
    return { allowed: true, status: "allowed", message: "No time restriction for this category." };
  }
  const match = catRules.find(r => (r.days.includes(ALL_DAYS) || r.days.includes(day)) && minutes >= toMinutes(r.startTime) && minutes < toMinutes(r.endTime));
  if (match) return { allowed: true, status: "allowed", message: match.description };
  const windows = catRules.map(r => `${r.days.join(" / ")} · ${r.startTime}–${r.endTime}`).join(" | ");
  return { allowed: false, status: "denied", message: `Outside the allowed window on ${day}. Windows: ${windows}` };
}

export function categoryLabelOf(state: State, category: CustomerCategory): string {
  return state.categoryLabels.find(c => c.category === category)?.label ?? category;
}

export function planAppliesToCategory(plan: Plan, category: CustomerCategory): boolean {
  const applicable = plan.applicableCategories;
  return applicable === "ALL" || applicable.includes(category);
}

export function planCategoryText(state: State, plan: Plan): string {
  return plan.applicableCategories === "ALL"
    ? "All categories"
    : plan.applicableCategories.map(c => categoryLabelOf(state, c)).join(", ");
}

export function sendEmail(state: State, dispatch: React.Dispatch<Action>, to: string, toName: string, subject: string, body: string, type: EmailLog["type"]) {
  const log: EmailLog = { id: `em_${Date.now()}`, to, toName, subject, body, type, sentAt: new Date().toISOString(), status: "sent" };
  dispatch({ type: "ADD_EMAIL_LOG", payload: log });
}

export function addAudit(dispatch: React.Dispatch<Action>, action: string, actor: string, details: string) {
  const log: AuditLog = { id: `a_${Date.now()}`, action, actor, timestamp: new Date().toISOString(), details };
  dispatch({ type: "ADD_AUDIT", payload: log });
}

export function formatETB(amount: number): string {
  return `Br ${amount.toLocaleString("en-US")}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ----------------------------- Phase 3 — Steam ----------------------------- */

/** Computed status of a Steam access (package or single session). */
export function computeSteamStatus(access: SteamAccess, settings: GymSettings): SteamStatus {
  const now = new Date();
  const end = new Date(access.endDate);
  if (end < now || access.remainingVisits <= 0) return "Expired";
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (daysLeft <= (settings.steamExpiringSoonDays || 5)) return "Expiring Soon";
  return "Active";
}

/** Every Steam access owned by a customer. */
export function steamAccessFor(state: State, customerId: string): SteamAccess[] {
  return state.steamAccess.filter(s => s.customerId === customerId);
}

/** Best usable Steam access (active or expiring soon) for a customer. */
export function activeSteamAccess(state: State, customerId: string): SteamAccess | null {
  const usable = steamAccessFor(state, customerId)
    .filter(s => computeSteamStatus(s, state.settings) !== "Expired")
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  return usable[0] ?? null;
}

/** Sells a Steam access: records the payment, creates the access, notifies the customer. */
export function sellSteamAccess(
  state: State,
  dispatch: React.Dispatch<Action>,
  member: Member,
  type: SteamType,
  method: Payment["method"],
  actor: string,
): SteamAccess {
  const settings = state.settings;
  const amount = type === "package" ? settings.steamPackagePrice : settings.steamPerVisitPrice;
  const visits = type === "package" ? settings.steamPackageVisits : 1;
  const now = new Date();
  const end = new Date(now.getTime() + settings.steamPackageDays * 86400000);
  const paymentId = generateId("pay");
  const payment: Payment = {
    id: paymentId,
    memberId: member.id,
    amount,
    date: now.toISOString().split("T")[0],
    method,
    type: "steam",
    note: type === "package" ? `Steam package (${settings.steamPackageVisits} sessions)` : "Single Steam session",
  };
  const access: SteamAccess = {
    id: generateId("sa"),
    customerId: member.id,
    type,
    startDate: now.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    remainingVisits: visits,
    status: "Active",
    paymentId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  dispatch({ type: "ADD_PAYMENT", payload: payment });
  dispatch({ type: "ADD_STEAM_ACCESS", payload: access });
  sendEmail(state, dispatch, member.email, member.name, "Your Steam access is active",
    `Hi ${member.name},

Your ${type === "package" ? "Steam package" : "single Steam session"} is active (${visits} session(s) valid until ${end.toLocaleDateString("en-US")}).

Payment: ${formatETB(amount)} (${method}).

See you soon at ${settings.gymName}.`,
    "receipt");
  addAudit(dispatch, "Steam Sale", actor, `${member.name} — ${type === "package" ? "package" : "session"} (${formatETB(amount)})`);
  return access;
}

/** Records a Steam entry; decrements the access and logs the usage. */
export function recordSteamUsage(
  state: State,
  dispatch: React.Dispatch<Action>,
  member: Member,
  actor: string,
  notes: string,
): { ok: boolean; message: string } {
  const access = activeSteamAccess(state, member.id);
  if (!access) return { ok: false, message: "No valid Steam access for this customer." };
  const updated: SteamAccess = {
    ...access,
    remainingVisits: Math.max(0, access.remainingVisits - 1),
    status: computeSteamStatus({ ...access, remainingVisits: access.remainingVisits - 1 }, state.settings),
    updatedAt: new Date().toISOString(),
  };
  const usage: SteamUsage = {
    id: generateId("su"),
    customerId: member.id,
    steamAccessId: access.id,
    recordedBy: actor,
    timestamp: new Date().toISOString(),
    notes,
  };
  dispatch({ type: "UPDATE_STEAM_ACCESS", payload: updated });
  dispatch({ type: "ADD_STEAM_USAGE", payload: usage });
  addAudit(dispatch, "Steam Entry", actor, `${member.name} — ${updated.remainingVisits} session(s) remaining`);
  return { ok: true, message: `Entry recorded. ${updated.remainingVisits} session(s) remaining.` };
}

/** Steam access status used to validate a check-in. */
export function evaluateSteamAccess(state: State, member: Member): AccessDecision {
  if (!state.settings.steamEnabled) {
    return { allowed: false, status: "denied", message: "Steam is not enabled by management." };
  }
  const access = activeSteamAccess(state, member.id);
  if (!access) {
    return { allowed: false, status: "denied", message: "No valid Steam access — sell a package or a single session." };
  }
  const status = computeSteamStatus(access, state.settings);
  if (status === "Expired") {
    return { allowed: false, status: "denied", message: "Steam access expired — renewal required." };
  }
  return { allowed: true, status: "allowed", message: `Valid Steam access — ${access.remainingVisits} session(s) remaining.` };
}

/* ---------------------- Phase 2 (Part 3) — Lockers ---------------------- */

/** Translator bound to the current language (EN / AM). */
export function useT() {
  const { state } = useGym();
  return (key: string, vars?: Record<string, string | number>) => translate(state.language, key, vars);
}

/** Active assignment of a locker, if any. */
export function activeAssignmentOf(state: State, lockerId: string): LockerAssignment | null {
  return state.lockerAssignments.find(a => a.lockerId === lockerId && a.status === "active") ?? null;
}

/** Active locker currently held by a member. */
export function memberActiveLocker(state: State, memberId: string): { locker: Locker; assignment: LockerAssignment } | null {
  const assignment = state.lockerAssignments.find(a => a.memberId === memberId && a.status === "active");
  if (!assignment) return null;
  const locker = state.lockers.find(l => l.id === assignment.lockerId);
  if (!locker) return null;
  return { locker, assignment };
}

export interface LockerStats {
  total: number;
  available: number;
  inUse: number;
  outOfService: number;
  utilization: number;
  unreturned: number;
  lostKeys: number;
  avgHoldDays: number;
  lostKeyFees: number;
}

/** Locker occupancy metrics (utilization rate, losses, average hold time). */
export function lockerStats(state: State): LockerStats {
  const total = state.lockers.length;
  const available = state.lockers.filter(l => l.status === "AVAILABLE").length;
  const inUse = state.lockers.filter(l => l.status === "IN_USE").length;
  const outOfService = state.lockers.filter(l => l.status === "OUT_OF_SERVICE").length;
  const active = state.lockerAssignments.filter(a => a.status === "active");
  const lost = state.lockerAssignments.filter(a => a.status === "lost");
  const unreturned = active.filter(a => !a.keyReturned).length;
  const now = Date.now();
  const holds = active.map(a => (now - new Date(a.assignedAt).getTime()) / 86400000).filter(d => d >= 0);
  const avgHoldDays = holds.length ? Math.round(holds.reduce((s, d) => s + d, 0) / holds.length) : 0;
  const lostKeyFees = lost.reduce((s, a) => s + a.lostKeyFee, 0);
  return {
    total,
    available,
    inUse,
    outOfService,
    utilization: total ? Math.round((inUse / total) * 100) : 0,
    unreturned,
    lostKeys: lost.length,
    avgHoldDays,
    lostKeyFees,
  };
}

/** Issues a locker — guards against double assignment (locker and member). */
export function issueLocker(
  state: State,
  dispatch: React.Dispatch<Action>,
  lockerId: string,
  member: Member,
  actor: string,
  dueDate: string | null,
  notes: string,
): { ok: boolean; message: string } {
  const msg = (k: string, vars?: Record<string, string | number>) => translate(state.language, k, vars);
  const locker = state.lockers.find(l => l.id === lockerId);
  if (!locker) return { ok: false, message: msg("locker.fillRequired") };
  if (activeAssignmentOf(state, lockerId)) return { ok: false, message: msg("locker.conflictLocker") };
  if (memberActiveLocker(state, member.id)) return { ok: false, message: msg("locker.conflictMember") };
  const assignment: LockerAssignment = {
    id: generateId("la"),
    lockerId,
    memberId: member.id,
    memberName: member.name,
    assignedAt: new Date().toISOString().split("T")[0],
    dueDate,
    returnedAt: null,
    status: "active",
    keyReturned: false,
    lostKeyFee: 0,
    issuedBy: actor,
    notes,
  };
  dispatch({ type: "ADD_LOCKER_ASSIGNMENT", payload: assignment });
  dispatch({ type: "UPDATE_LOCKER", payload: { ...locker, status: "IN_USE" } });
  addAudit(dispatch, "Locker Issued", actor, `${locker.number} → ${member.name}`);
  return { ok: true, message: msg("locker.issueSuccess", { n: locker.number, name: member.name }) };
}

/** Returns a locker: closes the active assignment and frees the locker. */
export function returnLocker(
  state: State,
  dispatch: React.Dispatch<Action>,
  lockerId: string,
  actor: string,
): { ok: boolean; message: string } {
  const msg = (k: string, vars?: Record<string, string | number>) => translate(state.language, k, vars);
  const assignment = activeAssignmentOf(state, lockerId);
  const locker = state.lockers.find(l => l.id === lockerId);
  if (!assignment || !locker) return { ok: false, message: msg("locker.fillRequired") };
  dispatch({
    type: "UPDATE_LOCKER_ASSIGNMENT",
    payload: { ...assignment, status: "returned", keyReturned: true, returnedAt: new Date().toISOString() },
  });
  dispatch({ type: "UPDATE_LOCKER", payload: { ...locker, status: "AVAILABLE" } });
  addAudit(dispatch, "Locker Returned", actor, `${locker.number} ← ${assignment.memberName}`);
  return { ok: true, message: msg("locker.returnSuccess", { n: locker.number }) };
}

/** Key not returned: locker out of service, optional fee, customer e-mail and audit entry. */
export function reportLostKey(
  state: State,
  dispatch: React.Dispatch<Action>,
  lockerId: string,
  actor: string,
  fee: number,
): { ok: boolean; message: string } {
  const msg = (k: string, vars?: Record<string, string | number>) => translate(state.language, k, vars);
  const assignment = activeAssignmentOf(state, lockerId);
  const locker = state.lockers.find(l => l.id === lockerId);
  if (!assignment || !locker) return { ok: false, message: msg("locker.fillRequired") };
  const member = state.members.find(m => m.id === assignment.memberId);
  dispatch({
    type: "UPDATE_LOCKER_ASSIGNMENT",
    payload: { ...assignment, status: "lost", keyReturned: false, returnedAt: new Date().toISOString(), lostKeyFee: fee },
  });
  dispatch({
    type: "UPDATE_LOCKER",
    payload: { ...locker, status: "OUT_OF_SERVICE", notes: msg("locker.lostKey") },
  });
  if (member) {
    sendEmail(
      state,
      dispatch,
      member.email,
      member.name,
      msg("email.lostKeySubject"),
      msg("email.lostKeyBody", { name: member.name, locker: locker.number, fee: `${state.settings.currency} ${fee}` }),
      "manual",
    );
  }
  addAudit(dispatch, "Locker Key Lost", actor, `${locker.number} — ${assignment.memberName} (${state.settings.currency} ${fee})`);
  return { ok: true, message: msg("locker.lostSuccess", { n: locker.number }) };
}