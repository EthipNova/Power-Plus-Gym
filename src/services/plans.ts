import { supabase } from "../integrations/supabase/client";
import { PLANS } from "../constants";
import type { Plan, CustomerCategory } from "../types";

const STORAGE_KEY = "powerplus_plans";

export function getLocalPlans(): Plan[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return PLANS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Unable to read plans from local storage", err);
  }
  return PLANS;
}

export function saveLocalPlans(plans: Plan[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (err) {
    console.warn("Unable to save plans to local storage", err);
  }
}

export function planMatchesCategory(plan: Plan, category: CustomerCategory | string): boolean {
  if (!plan.active) return false;
  if (plan.applicableCategories === "ALL") return true;
  if (!Array.isArray(plan.applicableCategories)) return false;
  return plan.applicableCategories.includes(category as CustomerCategory);
}

export async function fetchPlans(categoryFilter?: string): Promise<Plan[]> {
  try {
    let query = supabase.from("plans").select("*").eq("is_active", true);
    if (categoryFilter) {
      query = query.contains("applicable_categories", [categoryFilter]);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const mapped: Plan[] = (data as Array<{
        id: string;
        name: string;
        price: number;
        duration_days?: number | null;
        benefits?: string | null;
        is_active?: boolean | null;
        applicable_categories?: CustomerCategory[] | "ALL" | null;
        description?: string | null;
      }>).map(row => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        durationDays: Number(row.duration_days) || 30,
        perks: row.benefits ? row.benefits.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        active: Boolean(row.is_active ?? true),
        applicableCategories: (row.applicable_categories as CustomerCategory[] | "ALL") || "ALL",
        description: row.description || "",
      }));

      // Merge newly fetched plans into local store
      const local = getLocalPlans();
      const mergedMap = new Map<string, Plan>();
      for (const p of local) mergedMap.set(p.id, p);
      for (const p of mapped) mergedMap.set(p.id, p);
      const merged = Array.from(mergedMap.values());
      saveLocalPlans(merged);

      if (categoryFilter) {
        return mapped.filter(p => planMatchesCategory(p, categoryFilter));
      }
      return mapped;
    }
  } catch (err) {
    console.warn("Error querying plans from Supabase, using persistent local store:", err);
  }

  const local = getLocalPlans();
  if (categoryFilter) {
    return local.filter(p => planMatchesCategory(p, categoryFilter));
  }
  return local;
}

export async function createPlan(input: {
  name: string;
  price: number;
  durationDays: number;
  perks: string[];
  applicableCategories: CustomerCategory[] | "ALL";
  description?: string;
  id?: string;
}): Promise<Plan> {
  const plan: Plan = {
    id: input.id || `p_${Date.now()}`,
    name: input.name.trim(),
    price: Number(input.price),
    durationDays: Number(input.durationDays) || 30,
    perks: input.perks,
    active: true,
    applicableCategories: input.applicableCategories,
    description: input.description?.trim() || "",
  };

  const current = getLocalPlans();
  const next = [...current, plan];
  saveLocalPlans(next);

  // Attempt database save
  try {
    const applicableCategories = plan.applicableCategories === "ALL"
      ? ["REGULAR", "STUDENT", "MUSLIM", "AEROBICS"]
      : plan.applicableCategories;

    await (supabase.from("plans") as any).insert([{
      id: plan.id.startsWith("p_") ? undefined : plan.id,
      name: plan.name,
      price: plan.price,
      duration_days: plan.durationDays,
      description: plan.description || plan.name,
      benefits: plan.perks.join(", "),
      applicable_categories: applicableCategories,
      is_active: true,
    }]);
  } catch (err) {
    console.warn("Could not insert plan to Supabase, preserved in local store:", err);
  }

  return plan;
}

export async function updatePlan(plan: Plan): Promise<Plan> {
  const current = getLocalPlans();
  const next = current.map(p => p.id === plan.id ? plan : p);
  saveLocalPlans(next);

  // Attempt database update
  try {
    const applicableCategories = plan.applicableCategories === "ALL"
      ? ["REGULAR", "STUDENT", "MUSLIM", "AEROBICS"]
      : plan.applicableCategories;

    await (supabase.from("plans") as any).update({
      name: plan.name,
      price: plan.price,
      duration_days: plan.durationDays,
      description: plan.description || plan.name,
      benefits: plan.perks.join(", "),
      applicable_categories: applicableCategories,
      is_active: plan.active,
      updated_at: new Date().toISOString(),
    }).eq("id", plan.id);
  } catch (err) {
    console.warn("Could not update plan in Supabase, preserved in local store:", err);
  }

  return plan;
}

export async function deletePlan(id: string): Promise<void> {
  const current = getLocalPlans();
  const next = current.filter(p => p.id !== id);
  saveLocalPlans(next);

  try {
    await (supabase.from("plans") as any).delete().eq("id", id);
  } catch (err) {
    console.warn("Could not delete plan from Supabase:", err);
  }
}
