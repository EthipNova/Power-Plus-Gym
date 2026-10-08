import { supabase } from "../integrations/supabase/client";

export interface DashboardStats {
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
  activeMembers: number;
  expiringMembers: number;
  expiredMembers: number;
}

export interface SteamDashboardData {
  activePasses: number;
  revenue: number;
  recentEntries: number;
}

export interface MemberCategoryBreakdown {
  planName: string;
  memberCount: number;
  revenue: number;
}

export interface FinancialTrendPoint {
  name: string;
  revenue: number;
  expenses: number;
}

interface AmountRow {
  amount: number | string | null;
}

interface FinancialPaymentRow extends AmountRow {
  paid_at: string | null;
}

interface FinancialExpenseRow extends AmountRow {
  expense_date: string | null;
}

const sumAmounts = (rows: AmountRow[] | null) =>
  (rows ?? []).reduce((total, row) => {
    const amount = Number(row.amount);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [paymentsResult, expensesResult, activeMembershipsResult, expiringMembershipsResult, expiredMembershipsResult] = await Promise.all([
    supabase.from("payments").select("amount").eq("payment_status", "PAID"),
    supabase.from("expenses").select("amount"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "EXPIRING_SOON"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "EXPIRED"),
  ]);

  const firstError = paymentsResult.error
    ?? expensesResult.error
    ?? activeMembershipsResult.error
    ?? expiringMembershipsResult.error
    ?? expiredMembershipsResult.error;
  if (firstError) {
    throw new Error(`Unable to load dashboard statistics: ${firstError.message}`);
  }

  const totalRevenue = sumAmounts((paymentsResult.data ?? []) as AmountRow[]);
  const totalExpense = sumAmounts((expensesResult.data ?? []) as AmountRow[]);

  return {
    totalRevenue,
    totalExpense,
    netResult: totalRevenue - totalExpense,
    activeMembers: activeMembershipsResult.count ?? 0,
    expiringMembers: expiringMembershipsResult.count ?? 0,
    expiredMembers: expiredMembershipsResult.count ?? 0,
  };
}

export async function fetchSteamDashboardData(): Promise<SteamDashboardData> {
  const [passesResult, paymentsResult, usageResult] = await Promise.all([
    supabase.from("steam_access").select("id", { count: "exact", head: true }).eq("status", "Active"),
    supabase.from("payments").select("amount").eq("payment_status", "PAID").eq("service_type", "STEAM"),
    supabase.from("steam_usage").select("id").order("used_at", { ascending: false }).limit(5),
  ]);

  const firstError = passesResult.error ?? paymentsResult.error ?? usageResult.error;
  if (firstError) {
    throw new Error(`Unable to load Steam activity: ${firstError.message}`);
  }

  return {
    activePasses: passesResult.count ?? 0,
    revenue: sumAmounts((paymentsResult.data ?? []) as AmountRow[]),
    recentEntries: usageResult.data?.length ?? 0,
  };
}

export async function fetchMemberCategoryBreakdown(): Promise<MemberCategoryBreakdown[]> {
  const membershipsResult = await supabase
    .from("memberships")
    .select("customer_id, plan_id, status, created_at")
    .in("status", ["ACTIVE", "EXPIRING_SOON"])
    .order("created_at", { ascending: false });

  if (membershipsResult.error) {
    throw new Error(`Unable to load member plan breakdown: ${membershipsResult.error.message}`);
  }

  const currentMemberships = new Map<string, { planId: string }>();
  for (const membership of membershipsResult.data ?? []) {
    if (!membership.customer_id || !membership.plan_id || currentMemberships.has(membership.customer_id)) continue;
    currentMemberships.set(membership.customer_id, { planId: membership.plan_id });
  }

  const planIds = [...new Set([...currentMemberships.values()].map(membership => membership.planId))];
  if (planIds.length === 0) return [];

  const customerIds = [...currentMemberships.keys()];
  const [plansResult, paymentsResult] = await Promise.all([
    supabase.from("plans").select("id, name").in("id", planIds),
    supabase.from("payments").select("customer_id, amount").eq("payment_status", "PAID").in("customer_id", customerIds),
  ]);
  const firstError = plansResult.error ?? paymentsResult.error;
  if (firstError) {
    throw new Error(`Unable to load member plan breakdown: ${firstError.message}`);
  }

  const planNames = new Map((plansResult.data ?? []).map(plan => [plan.id, plan.name]));
  const breakdown = new Map<string, { memberCount: number; customerIds: Set<string>; revenue: number }>();
  for (const [customerId, membership] of currentMemberships.entries()) {
    const planName = planNames.get(membership.planId);
    if (planName) {
      const current = breakdown.get(planName) ?? { memberCount: 0, customerIds: new Set<string>(), revenue: 0 };
      current.customerIds.add(customerId);
      current.memberCount = current.customerIds.size;
      breakdown.set(planName, current);
    }
  }
  for (const payment of paymentsResult.data ?? []) {
    const membership = currentMemberships.get(payment.customer_id);
    const planName = membership ? planNames.get(membership.planId) : undefined;
    const current = planName ? breakdown.get(planName) : undefined;
    if (current) current.revenue += Number(payment.amount) || 0;
  }

  return [...breakdown.entries()]
    .map(([planName, values]) => ({ planName, memberCount: values.memberCount, revenue: values.revenue }))
    .sort((left, right) => right.memberCount - left.memberCount);
}

export async function fetchFinancialTrend(): Promise<FinancialTrendPoint[]> {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startDate = firstMonth.toISOString();
  const endDate = nextMonth.toISOString();
  const startExpenseDate = startDate.slice(0, 10);
  const endExpenseDate = endDate.slice(0, 10);

  const [paymentsResult, expensesResult] = await Promise.all([
    supabase.from("payments").select("amount, paid_at").eq("payment_status", "PAID").gte("paid_at", startDate).lt("paid_at", endDate),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", startExpenseDate).lt("expense_date", endExpenseDate),
  ]);

  const firstError = paymentsResult.error ?? expensesResult.error;
  if (firstError) {
    throw new Error(`Unable to load financial trend: ${firstError.message}`);
  }

  const totals = new Map<string, { revenue: number; expenses: number }>();
  for (let offset = 0; offset < 6; offset += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
    totals.set(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`, { revenue: 0, expenses: 0 });
  }

  for (const payment of (paymentsResult.data ?? []) as FinancialPaymentRow[]) {
    const month = payment.paid_at?.slice(0, 7);
    const total = month ? totals.get(month) : undefined;
    if (total) total.revenue += Number(payment.amount) || 0;
  }
  for (const expense of (expensesResult.data ?? []) as FinancialExpenseRow[]) {
    const month = expense.expense_date?.slice(0, 7);
    const total = month ? totals.get(month) : undefined;
    if (total) total.expenses += Number(expense.amount) || 0;
  }

  if ((paymentsResult.data?.length ?? 0) === 0 && (expensesResult.data?.length ?? 0) === 0) return [];

  return [...totals.entries()].map(([key, values]) => {
    const [year, month] = key.split("-").map(Number);
    return {
      name: new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" }),
      ...values,
    };
  });
}