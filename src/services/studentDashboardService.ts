import { supabase } from "../integrations/supabase/client";

export interface StudentDashboardData {
  customer: {
    id: string;
    customerCode: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
    email: string | null;
    joinDate: string;
    status: string;
    studentId: string;
    institution: string;
    verificationStatus: string;
    verifiedAt: string | null;
    requestedPlanId: string | null;
  };
  membership: null | {
    id: string;
    planId: string;
    planName: string;
    planPrice: number;
    planDurationDays: number;
    planBenefits: string | null;
    startDate: string;
    endDate: string;
    status: string;
    priceAtPurchase: number;
    daysRemaining: number;
    progressPercent: number;
    isExpired: boolean;
  };
  requestedPlan: null | { id: string; name: string; price: number; durationDays: number; benefits: string | null };
  attendance: { total: number; lastVisit: string | null; recent: Array<{ id: string; checkedInAt: string; checkInMethod: string }> };
  payments: Array<{ id: string; amount: number; method: string; status: string; paidAt: string | null; createdAt: string }>;
  paymentCount: number;
  balanceDue: number | null;
  locker: null | { number: string; section: string; assignedAt: string; dueDate: string | null };
  accessRules: Array<{ id: string; days: string[]; startTime: string; endTime: string; description: string }>;
}

export type StudentDashboardState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "not_found"; message: string }
  | { status: "success"; data: StudentDashboardData };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_STATUSES = new Set(["PAID", "COMPLETED", "VERIFIED"]);
const REVERSAL_STATUSES = new Set(["REFUNDED", "REVERSED"]);

function toString(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

export async function fetchStudentDashboardData(): Promise<StudentDashboardState> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) return { status: "error", error: `Unable to validate your session: ${authError.message}` };
  const authUser = authData.user;
  if (!authUser || !UUID_REGEX.test(authUser.id)) {
    return { status: "not_found", message: "Sign in with the student account linked to your gym profile." };
  }

  // The generated Supabase types predate the student columns in the forward migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerResult = await (supabase as any)
    .from("customers")
    .select("id, user_id, customer_code, first_name, last_name, customer_type, status, join_date, phone, email, student_id, institution, student_verification_status, student_verified_at, requested_plan_id")
    .eq("user_id", authUser.id)
    .eq("customer_type", "STUDENT")
    .maybeSingle();
  if (customerResult.error) return { status: "error", error: `Unable to load student profile: ${customerResult.error.message}` };
  if (!customerResult.data) return { status: "not_found", message: "No Student profile is linked to this signed-in account." };

  const customer = customerResult.data as unknown as Record<string, unknown>;
  const customerId = toString(customer.id);
  let requestedPlan: StudentDashboardData["requestedPlan"] = null;
  if (customer.requested_plan_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestedPlanResult = await (supabase as any).from("plans")
      .select("id, name, price, duration_days, benefits")
      .eq("id", String(customer.requested_plan_id)).maybeSingle();
    if (requestedPlanResult.error) return { status: "error", error: `Unable to load selected plan: ${requestedPlanResult.error.message}` };
    if (requestedPlanResult.data) requestedPlan = {
      id: requestedPlanResult.data.id, name: requestedPlanResult.data.name,
      price: Number(requestedPlanResult.data.price), durationDays: Number(requestedPlanResult.data.duration_days),
      benefits: requestedPlanResult.data.benefits ?? null,
    };
  }
  const [membershipResult, attendanceResult, attendanceCountResult, paymentsResult, lockerResult, accessResult] = await Promise.all([
    supabase.from("memberships").select("id, plan_id, start_date, end_date, status, price_at_purchase, plans(id, name, price, duration_days, benefits)")
      .eq("customer_id", customerId).order("end_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("attendance").select("id, checked_in_at, check_in_method").eq("customer_id", customerId)
      .order("checked_in_at", { ascending: false }).limit(20),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase.from("payments").select("id, membership_id, amount, payment_method, payment_status, service_type, paid_at, created_at")
      .eq("customer_id", customerId).eq("service_type", "MEMBERSHIP").order("created_at", { ascending: false }),
    supabase.from("locker_assignments").select("id, assigned_at, due_date, status, lockers(locker_number, location)")
      .eq("customer_id", customerId).eq("status", "active").maybeSingle(),
    supabase.from("category_access_rules").select("id, days, start_time, end_time, description")
      .eq("category", "STUDENT").eq("is_active", true).order("start_time", { ascending: true }),
  ]);

  const failed = [
    ["membership", membershipResult.error], ["attendance", attendanceResult.error],
    ["attendance count", attendanceCountResult.error], ["payments", paymentsResult.error],
    ["locker", lockerResult.error], ["Student access schedule", accessResult.error],
  ].find(([, error]) => error);
  if (failed) {
    const [label, error] = failed as [string, { message: string }];
    return { status: "error", error: `Unable to load ${label}: ${error.message}` };
  }

  const membershipRow = (membershipResult as unknown as { data: unknown }).data as Record<string, unknown> | null;
  const planValue = membershipRow?.plans;
  const planRow = (Array.isArray(planValue) ? planValue[0] : planValue) as Record<string, unknown> | null | undefined;
  let membership: StudentDashboardData["membership"] = null;
  if (membershipRow) {
    const startDate = toString(membershipRow.start_date);
    const endDate = toString(membershipRow.end_date);
    const planDurationDays = Number(planRow?.duration_days ?? 0);
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59`).getTime();
    const daysRemaining = Number.isFinite(end) ? Math.max(0, Math.ceil((end - Date.now()) / 86_400_000)) : 0;
    const status = toString(membershipRow.status).toUpperCase();
    membership = {
      id: toString(membershipRow.id),
      planId: toString(membershipRow.plan_id),
      planName: toString(planRow?.name, "Plan details unavailable"),
      planPrice: Number(planRow?.price ?? membershipRow.price_at_purchase ?? 0),
      planDurationDays,
      planBenefits: planRow?.benefits == null ? null : String(planRow.benefits),
      startDate,
      endDate,
      status,
      priceAtPurchase: Number(membershipRow.price_at_purchase ?? 0),
      daysRemaining,
      progressPercent: Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))) : 0,
      isExpired: !["ACTIVE", "EXPIRING_SOON", "EXPIRING SOON"].includes(status) || daysRemaining <= 0,
    };
  }

  const paymentRows = (paymentsResult.data ?? []) as unknown as Array<Record<string, unknown>>;
  const payments = paymentRows.map(row => ({
    id: toString(row.id), amount: Number(row.amount ?? 0), method: toString(row.payment_method),
    status: toString(row.payment_status).toUpperCase(), paidAt: row.paid_at == null ? null : String(row.paid_at),
    createdAt: toString(row.created_at),
  }));
  const paidForCurrentMembership = membership ? paymentRows.reduce((sum, row) => {
    if (toString(row.membership_id) !== membership?.id) return sum;
    const status = toString(row.payment_status).toUpperCase();
    const amount = Number(row.amount ?? 0);
    if (PAID_STATUSES.has(status)) return sum + amount;
    if (REVERSAL_STATUSES.has(status)) return sum - amount;
    return sum;
  }, 0) : null;
  const balanceDue = membership && paidForCurrentMembership != null
    ? Math.max(0, membership.priceAtPurchase - paidForCurrentMembership)
    : null;

  const attendance = (attendanceResult.data ?? []) as unknown as Array<Record<string, unknown>>;
  const lockerRow = lockerResult.data as unknown as Record<string, unknown> | null;
  const lockerValue = lockerRow?.lockers;
  const lockerData = (Array.isArray(lockerValue) ? lockerValue[0] : lockerValue) as Record<string, unknown> | null | undefined;
  const accessRows = (accessResult.data ?? []) as unknown as Array<Record<string, unknown>>;

  return {
    status: "success",
    data: {
      customer: {
        id: customerId,
        customerCode: toString(customer.customer_code),
        firstName: toString(customer.first_name),
        lastName: toString(customer.last_name),
        fullName: `${toString(customer.first_name)} ${toString(customer.last_name)}`.trim(),
        phone: toString(customer.phone), email: customer.email == null ? null : String(customer.email),
        joinDate: toString(customer.join_date), status: toString(customer.status),
        studentId: toString(customer.student_id), institution: toString(customer.institution),
        verificationStatus: toString(customer.student_verification_status, "PENDING"),
        verifiedAt: customer.student_verified_at == null ? null : String(customer.student_verified_at),
        requestedPlanId: customer.requested_plan_id == null ? null : String(customer.requested_plan_id),
      },
      membership,
      requestedPlan,
      attendance: {
        total: attendanceCountResult.count ?? 0,
        lastVisit: attendance[0]?.checked_in_at == null ? null : String(attendance[0].checked_in_at),
        recent: attendance.map(row => ({ id: toString(row.id), checkedInAt: toString(row.checked_in_at), checkInMethod: toString(row.check_in_method) })),
      },
      payments,
      paymentCount: payments.filter(payment => PAID_STATUSES.has(payment.status)).length,
      balanceDue,
      locker: lockerRow && lockerData ? {
        number: toString(lockerData.locker_number), section: toString(lockerData.location, "General"),
        assignedAt: toString(lockerRow.assigned_at), dueDate: lockerRow.due_date == null ? null : String(lockerRow.due_date),
      } : null,
      accessRules: accessRows.map(row => ({
        id: toString(row.id), days: Array.isArray(row.days) ? row.days.map(String) : [],
        startTime: toString(row.start_time).slice(0, 5), endTime: toString(row.end_time).slice(0, 5),
        description: toString(row.description),
      })),
    },
  };
}
