import { supabase } from "../integrations/supabase/client";

interface RegisterCustomerInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  planName: string;
  planPrice: number;
  durationDays: number;
}

interface RegisteredCustomer {
  id: string;
  userId: string;
  customerCode: string;
  membershipCreated: boolean;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || (parts[0] ?? "") };
}

function isDuplicateError(message: string) {
  return /duplicate|unique|already exists/i.test(message);
}

async function nextCustomerCode(attempt: number) {
  const { count, error } = await supabase.from("customers").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Unable to generate customer code: ${error.message}`);
  return `PP-${String((count ?? 0) + attempt).padStart(3, "0")}`;
}

export async function registerCustomer(input: RegisterCustomerInput): Promise<RegisteredCustomer> {
  const [phoneResult, emailResult] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("phone", input.phone.trim()),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("email", input.email.trim()),
  ]);
  const duplicateCheckError = phoneResult.error ?? emailResult.error;
  if (duplicateCheckError) throw new Error(`Unable to check existing customer: ${duplicateCheckError.message}`);
  if ((phoneResult.count ?? 0) > 0) throw new Error("A customer with this phone number already exists.");
  if ((emailResult.count ?? 0) > 0) throw new Error("A customer with this email already exists.");

  let planId: string | null = null;
  type PlanLookup = { data: { id: string } | null; error: { message: string } | null };
  const namedPlanResult = await supabase.from("plans").select("id").ilike("name", input.planName.trim()).eq("is_active", true).limit(1).maybeSingle() as unknown as PlanLookup;
  if (namedPlanResult.error) {
    console.warn("Unable to resolve a database plan; customer will be created without a membership", namedPlanResult.error);
  } else if (namedPlanResult.data) {
    planId = namedPlanResult.data.id;
  } else {
    const fallbackPlanResult = await supabase.from("plans").select("id").eq("price", input.planPrice).eq("duration_days", input.durationDays).eq("is_active", true).limit(1).maybeSingle() as unknown as PlanLookup;
    if (fallbackPlanResult.error) console.warn("Unable to resolve a fallback database plan", fallbackPlanResult.error);
    else planId = fallbackPlanResult.data?.id ?? null;
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
  });
  if (authError) {
    if (/rate limit|email.*limit|too many requests/i.test(authError.message)) {
      throw new Error("Supabase email limit reached. Wait for the limit to reset or disable email confirmation in Supabase Auth settings while testing.");
    }
    throw new Error(`Registration failed: ${authError.message}`);
  }
  if (!authData.user) throw new Error("Registration failed: Supabase did not return a user.");

  const { firstName, lastName } = splitName(input.fullName);
  let customerId = "";
  let customerCode = "";
  let customerError: { message: string } | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    customerCode = await nextCustomerCode(attempt);
    const customerIdForInsert = crypto.randomUUID();
    const result = await supabase.from("customers").insert([{
      id: customerIdForInsert,
      user_id: authData.user.id,
      customer_code: customerCode,
      first_name: firstName,
      last_name: lastName,
      phone: input.phone.trim(),
      email: input.email.trim(),
      join_date: new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
    }] as never) as unknown as { error: { message: string } | null };

    if (!result.error) {
      customerId = customerIdForInsert;
      customerError = null;
      break;
    }
    customerError = result.error;
    if (!result.error || !isDuplicateError(result.error.message)) break;
  }

  if (!customerId || customerError) {
    throw new Error(`Customer creation failed: ${customerError?.message ?? "No customer record was created."}`);
  }

  if (!planId) {
    return { id: customerId, userId: authData.user.id, customerCode, membershipCreated: false };
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + input.durationDays * 86400000);
  const membershipResult = await supabase.from("memberships").insert([{
    customer_id: customerId,
    plan_id: planId,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    status: "ACTIVE",
    price_at_purchase: input.planPrice,
    auto_renew: false,
    created_by: authData.user.id,
  }] as never);

  if (membershipResult.error) {
    console.error("Membership creation failed after customer registration", membershipResult.error);
    return { id: customerId, userId: authData.user.id, customerCode, membershipCreated: false };
  }

  return { id: customerId, userId: authData.user.id, customerCode, membershipCreated: true };
}
