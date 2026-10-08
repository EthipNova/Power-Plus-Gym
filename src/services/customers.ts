import { supabase } from "../integrations/supabase/client";

export interface CustomerRecord {
  id: string;
  customer_code: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  join_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipRecord {
  id: string;
  customer_id: string;
  plan_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

export interface PlanRecord {
  id: string;
  name: string;
}

export interface CustomerPage {
  customers: CustomerRecord[];
  memberships: MembershipRecord[];
  plans: PlanRecord[];
  total: number;
}

const CUSTOMER_FIELDS = "id, customer_code, user_id, first_name, last_name, phone, email, national_id, date_of_birth, gender, address, join_date, status, notes, created_at, updated_at";

export async function fetchCustomers({ search, status, page, pageSize }: { search: string; status: string; page: number; pageSize: number }): Promise<CustomerPage> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("customers").select(CUSTOMER_FIELDS, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);

  if (status !== "all") query = query.eq("status", status.toUpperCase());
  const normalizedSearch = search.trim().replace(/[,%()]/g, " ");
  if (normalizedSearch) {
    query = query.or(`first_name.ilike.%${normalizedSearch}%,last_name.ilike.%${normalizedSearch}%,customer_code.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Unable to load customers: ${error.message}`);

  const customers = (data ?? []) as CustomerRecord[];
  if (customers.length === 0) return { customers, memberships: [], plans: [], total: count ?? 0 };

  const membershipsResult = await supabase
    .from("memberships")
    .select("id, customer_id, plan_id, start_date, end_date, status")
    .in("customer_id", customers.map(customer => customer.id));
  if (membershipsResult.error) throw new Error(`Unable to load customer memberships: ${membershipsResult.error.message}`);

  const memberships = (membershipsResult.data ?? []) as MembershipRecord[];
  const planIds = [...new Set(memberships.map(membership => membership.plan_id).filter((planId): planId is string => Boolean(planId)))];
  if (planIds.length === 0) return { customers, memberships, plans: [], total: count ?? 0 };

  const plansResult = await supabase.from("plans").select("id, name").in("id", planIds);
  if (plansResult.error) throw new Error(`Unable to load membership plans: ${plansResult.error.message}`);

  return { customers, memberships, plans: (plansResult.data ?? []) as PlanRecord[], total: count ?? 0 };
}