import { supabase } from "../integrations/supabase/client";

export interface ReportCategoryRow {
  planName: string;
  members: number;
  revenue: number;
  visits: number;
  denied: string;
  revenuePerMember: number;
}

interface CustomerRow {
  id: string;
}

interface MembershipRow {
  customer_id: string;
  plan_id: string | null;
  status: string | null;
  created_at: string;
}

interface PlanRow {
  id: string;
  name: string;
}

interface PaymentRow {
  customer_id: string;
  amount: number | string | null;
}

interface AttendanceRow {
  customer_id: string;
}

export async function fetchReportCategoryRows(): Promise<ReportCategoryRow[]> {
  const [customersResult, membershipsResult] = await Promise.all([
    supabase.from("customers").select("id"),
    supabase.from("memberships").select("customer_id, plan_id, status, created_at").order("created_at", { ascending: false }),
  ]);
  const initialError = customersResult.error ?? membershipsResult.error;
  if (initialError) throw new Error(`Unable to load report categories: ${initialError.message}`);

  const customers = (customersResult.data ?? []) as CustomerRow[];
  if (customers.length === 0) return [];
  const customerIds = customers.map(customer => customer.id);
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const currentMemberships = new Map<string, MembershipRow>();
  for (const membership of memberships) {
    if (!currentMemberships.has(membership.customer_id)) currentMemberships.set(membership.customer_id, membership);
  }

  const planIds = [...new Set([...currentMemberships.values()].map(membership => membership.plan_id).filter((id): id is string => Boolean(id)))];
  const [plansResult, paymentsResult, attendanceResult] = await Promise.all([
    planIds.length ? supabase.from("plans").select("id, name").in("id", planIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("payments").select("customer_id, amount").eq("payment_status", "PAID").in("customer_id", customerIds),
    supabase.from("attendance").select("customer_id").in("customer_id", customerIds),
  ]);
  const relatedError = plansResult.error ?? paymentsResult.error;
  if (relatedError) throw new Error(`Unable to load report category details: ${relatedError.message}`);
  if (attendanceResult.error) console.warn("Unable to load attendance enrichment for report categories", attendanceResult.error);

  const planNames = new Map((plansResult.data as PlanRow[]).map(plan => [plan.id, plan.name]));
  const customerPlan = new Map<string, string>();
  for (const customer of customers) {
    const planId = currentMemberships.get(customer.id)?.plan_id;
    customerPlan.set(customer.id, planId ? planNames.get(planId) ?? "No plan" : "No plan");
  }

  const grouped = new Map<string, { customerIds: Set<string>; revenue: number; visits: number }>();
  for (const customer of customers) {
    const planName = customerPlan.get(customer.id) ?? "No plan";
    const current = grouped.get(planName) ?? { customerIds: new Set<string>(), revenue: 0, visits: 0 };
    current.customerIds.add(customer.id);
    grouped.set(planName, current);
  }
  for (const payment of (paymentsResult.data ?? []) as PaymentRow[]) {
    const planName = customerPlan.get(payment.customer_id);
    const current = planName ? grouped.get(planName) : undefined;
    if (current) current.revenue += Number(payment.amount) || 0;
  }
  for (const attendance of (attendanceResult.data ?? []) as AttendanceRow[]) {
    const planName = customerPlan.get(attendance.customer_id);
    const current = planName ? grouped.get(planName) : undefined;
    if (current) current.visits += 1;
  }

  return [...grouped.entries()]
    .map(([planName, values]) => ({
      planName,
      members: values.customerIds.size,
      revenue: values.revenue,
      visits: values.visits,
      denied: "—",
      revenuePerMember: values.customerIds.size ? Math.round(values.revenue / values.customerIds.size) : 0,
    }))
    .sort((left, right) => right.members - left.members);
}
