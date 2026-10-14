import { supabase } from "../integrations/supabase/client";

export interface CustomerSteamAccess {
  id: string;
  customerId: string;
  type: string;
  totalVisits: number;
  remainingVisits: number;
  price: number;
  status: string;
  paymentId: string | null;
  startDate: string | null;
  endDate: string | null;
  expiryDate: string | null;
  createdAt: string;
}

export interface CustomerSteamUsage {
  id: string;
  accessId: string | null;
  customerId: string;
  usedAt: string;
  visitsUsed: number;
  remainingAfter: number;
  loggedBy: string | null;
  note: string | null;
  createdAt: string;
}

export interface FetchSteamAccessResponse {
  data: CustomerSteamAccess[];
  activePass: CustomerSteamAccess | null;
  latestPass: CustomerSteamAccess | null;
  error: string | null;
}

export interface FetchSteamUsageResponse {
  data: CustomerSteamUsage[];
  error: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a provided string is a valid UUIDv4.
 */
export function isValidUuid(id: string): boolean {
  return Boolean(id && UUID_REGEX.test(id));
}

/**
 * Evaluates the actual state of a Steam pass.
 */
export function determinePassState(pass: CustomerSteamAccess | null): "Active" | "Expired" | "No Active Pass" {
  if (!pass) return "No Active Pass";

  const isExpiredByDate = pass.endDate ? new Date(pass.endDate).getTime() < Date.now() : false;
  const isExpiredByVisits = pass.remainingVisits <= 0;
  const isExplicitExpired = pass.status?.toLowerCase() === "expired";

  if (isExplicitExpired || isExpiredByDate || isExpiredByVisits) {
    return "Expired";
  }

  if (pass.status?.toLowerCase() === "active") {
    return "Active";
  }

  return "Expired";
}

/**
 * Fetches all Steam access passes for a specific customer from Supabase.
 * Validates customer UUID to reject invalid IDs cleanly.
 */
export async function fetchCustomerSteamAccess(customerId: string): Promise<FetchSteamAccessResponse> {
  if (!isValidUuid(customerId)) {
    return {
      data: [],
      activePass: null,
      latestPass: null,
      error: "Invalid customer ID format. Expected a standard UUID.",
    };
  }

  try {
    const { data, error } = await supabase
      .from("steam_access")
      .select("id, customer_id, type, total_visits, remaining_visits, price, status, payment_id, start_date, end_date, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SteamService] Error fetching customer steam access:", error);
      return {
        data: [],
        activePass: null,
        latestPass: null,
        error: "Unable to load Steam information. Please try again.",
      };
    }

    const records: CustomerSteamAccess[] = (data || []).map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      type: row.type || "package",
      totalVisits: Number(row.total_visits ?? 0),
      remainingVisits: Number(row.remaining_visits ?? 0),
      price: Number(row.price ?? 0),
      status: row.status || "Expired",
      paymentId: row.payment_id ?? null,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      expiryDate: row.end_date ?? null,
      createdAt: row.created_at,
    }));

    // Find the currently active pass if one exists and hasn't expired
    const activePass =
      records.find(r => determinePassState(r) === "Active") || null;

    // The most recent pass regardless of status (or null)
    const latestPass = records[0] || null;

    return {
      data: records,
      activePass,
      latestPass,
      error: null,
    };
  } catch (err: any) {
    console.error("[SteamService] Unexpected error in fetchCustomerSteamAccess:", err);
    return {
      data: [],
      activePass: null,
      latestPass: null,
      error: err?.message || "An unexpected error occurred while loading Steam access.",
    };
  }
}

/**
 * Fetches Steam entry usage history for a specific customer from Supabase.
 * Ordered by newest first.
 */
export async function fetchCustomerSteamUsage(customerId: string): Promise<FetchSteamUsageResponse> {
  if (!isValidUuid(customerId)) {
    return {
      data: [],
      error: "Invalid customer ID format. Expected a standard UUID.",
    };
  }

  try {
    const { data, error } = await supabase
      .from("steam_usage")
      .select("id, access_id, customer_id, used_at, visits_used, remaining_after, logged_by, note, created_at")
      .eq("customer_id", customerId)
      .order("used_at", { ascending: false });

    if (error) {
      console.error("[SteamService] Error fetching customer steam usage:", error);
      return {
        data: [],
        error: "Unable to load Steam usage history. Please try again.",
      };
    }

    const records: CustomerSteamUsage[] = (data || []).map((row: any) => ({
      id: row.id,
      accessId: row.access_id ?? null,
      customerId: row.customer_id,
      usedAt: row.used_at,
      visitsUsed: Number(row.visits_used ?? 1),
      remainingAfter: Number(row.remaining_after ?? 0),
      loggedBy: row.logged_by ?? null,
      note: row.note ?? null,
      createdAt: row.created_at,
    }));

    return {
      data: records,
      error: null,
    };
  } catch (err: any) {
    console.error("[SteamService] Unexpected error in fetchCustomerSteamUsage:", err);
    return {
      data: [],
      error: err?.message || "An unexpected error occurred while loading Steam usage.",
    };
  }
}
