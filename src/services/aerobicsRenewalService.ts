import { supabase } from "../integrations/supabase/client";

export interface AerobicsRenewalCustomer {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  customerType: string;
  status: string;
  email: string | null;
  phone: string;
}

export interface AerobicsRenewalPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string | null;
  benefits: string | null;
}

export interface AerobicsCurrentMembership {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isExpired: boolean;
  priceAtPurchase: number;
  plan: AerobicsRenewalPlan | null;
}

export interface AerobicsRenewalData {
  customer: AerobicsRenewalCustomer;
  currentMembership: AerobicsCurrentMembership | null;
  availablePlans: AerobicsRenewalPlan[];
}

export type AerobicsRenewalState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "not_found"; message: string }
  | { status: "success"; data: AerobicsRenewalData };

interface CustomerDbRow {
  id: string;
  customer_code: string;
  first_name: string;
  last_name: string;
  customer_type: string;
  status: string;
  email: string | null;
  phone: string;
}

interface PlanDbRow {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  description: string | null;
  benefits: string | null;
  is_active: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Service for the Aerobics Customer Renew functionality.
 * Reads real customer, active membership, and eligible plans from Supabase.
 */
export async function fetchAerobicsRenewalData(
  customerId: string
): Promise<AerobicsRenewalState> {
  if (!customerId || !UUID_REGEX.test(customerId)) {
    return {
      status: "error",
      error: "Invalid customer ID format. Expected a standard UUID.",
    };
  }

  try {
    // 1. Fetch Customer
    const customerRes = await supabase
      .from("customers")
      .select("id, customer_code, first_name, last_name, customer_type, status, email, phone")
      .eq("id", customerId)
      .maybeSingle();

    if (customerRes.error) {
      console.error("[AerobicsRenewalService] Error fetching customer:", customerRes.error);
      return { status: "error", error: "Unable to load customer profile from database." };
    }

    const customerRow = customerRes.data as CustomerDbRow | null;
    if (!customerRow) {
      return { status: "not_found", message: "Customer profile not found in database." };
    }

    const customer: AerobicsRenewalCustomer = {
      id: customerRow.id,
      customerCode: customerRow.customer_code,
      firstName: customerRow.first_name,
      lastName: customerRow.last_name,
      fullName: `${customerRow.first_name} ${customerRow.last_name}`.trim(),
      customerType: customerRow.customer_type,
      status: customerRow.status,
      email: customerRow.email ?? null,
      phone: customerRow.phone,
    };

    // 2. Fetch Current Membership and Available Plans in parallel
    const membershipPromise = supabase
      .from("memberships")
      .select(`
        id,
        status,
        start_date,
        end_date,
        price_at_purchase,
        plans (
          id,
          name,
          price,
          duration_days,
          description,
          benefits
        )
      `)
      .eq("customer_id", customerId)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const plansPromise = supabase
      .from("plans")
      .select("id, name, price, duration_days, description, benefits, is_active")
      .eq("is_active", true)
      .order("price", { ascending: true });

    const [membershipRes, plansRes] = await Promise.all([
      membershipPromise,
      plansPromise,
    ]);

    if (plansRes.error) {
      console.error("[AerobicsRenewalService] Error fetching plans:", plansRes.error);
      return { status: "error", error: "Unable to load renewal plans from database." };
    }

    // Map Membership
    let currentMembership: AerobicsCurrentMembership | null = null;
    const mData = membershipRes.data as any;
    if (mData) {
      const pRow = Array.isArray(mData.plans) ? mData.plans[0] : mData.plans;
      const daysRemaining = mData.end_date
        ? Math.max(0, Math.ceil((new Date(mData.end_date).getTime() - Date.now()) / 86400000))
        : 0;

      currentMembership = {
        id: mData.id,
        status: mData.status,
        startDate: mData.start_date,
        endDate: mData.end_date,
        daysRemaining,
        isExpired: daysRemaining <= 0,
        priceAtPurchase: Number(mData.price_at_purchase) || 0,
        plan: pRow
          ? {
              id: pRow.id,
              name: pRow.name,
              price: Number(pRow.price) || 0,
              durationDays: pRow.duration_days || 30,
              description: pRow.description ?? null,
              benefits: pRow.benefits ?? null,
            }
          : null,
      };
    }

    // Map Available Plans (filtering for Aerobics suitability if multiple plans exist)
    const rawPlans = (plansRes.data || []) as PlanDbRow[];
    const aerobicsPlans = rawPlans.filter(p =>
      p.name.toLowerCase().includes("aerobics") || p.name.toLowerCase().includes("dance")
    );
    const applicablePlans = aerobicsPlans.length > 0 ? aerobicsPlans : rawPlans;

    const availablePlans: AerobicsRenewalPlan[] = applicablePlans.map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      durationDays: p.duration_days || 30,
      description: p.description ?? null,
      benefits: p.benefits ?? null,
    }));

    return {
      status: "success",
      data: {
        customer,
        currentMembership,
        availablePlans,
      },
    };
  } catch (err: any) {
    console.error("[AerobicsRenewalService] Unexpected error:", err);
    return {
      status: "error",
      error: err?.message || "An unexpected error occurred while loading renewal data.",
    };
  }
}

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export interface ProofFileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a payment screenshot file before upload.
 * Rejects oversized files, empty files, and unsupported MIME/extension types.
 */
export function validateProofFile(file: File | null | undefined): ProofFileValidationResult {
  if (!file) {
    return { valid: false, error: "Please select an image file to upload." };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 bytes). Please choose a valid image." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size exceeds the 5MB limit (${sizeMb} MB). Please choose a smaller image.`,
    };
  }

  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.includes(ext);
  const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

  if (!hasValidExt || !hasValidMime) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a JPG, PNG, or WebP screenshot.",
    };
  }

  return { valid: true };
}

export interface SubmitRenewalPaymentProofParams {
  customerId: string;
  membershipId: string | null;
  plan: AerobicsRenewalPlan;
  paymentMethod: "telebirr" | "cbe_birr";
  file: File;
}

export interface SubmitRenewalPaymentProofResult {
  success: boolean;
  paymentId?: string;
  filePath?: string;
  error?: string;
}

/**
 * Uploads a payment screenshot to private Supabase Storage and records a pending payment request.
 * CRITICAL SAFETY:
 * - Payment status is set to PENDING (never marked PAID).
 * - Membership is NOT automatically extended.
 * - Membership status is NOT changed to ACTIVE.
 * - screenshot is stored in private storage bucket 'payment-proofs'.
 */
export async function submitRenewalPaymentProof(
  params: SubmitRenewalPaymentProofParams
): Promise<SubmitRenewalPaymentProofResult> {
  const { customerId, membershipId, plan, paymentMethod, file } = params;

  // 1. Pre-upload file validation
  const validation = validateProofFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (!customerId || !UUID_REGEX.test(customerId)) {
    return { success: false, error: "Invalid customer ID. Renewal submission rejected." };
  }

  if (!plan || !plan.id || plan.price <= 0) {
    return { success: false, error: "Invalid plan selected. Renewal submission rejected." };
  }

  try {
    // 2. Generate clean, non-sensitive, deterministic storage path
    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 10);
    const storagePath = `proofs/${customerId}/${timestamp}_${randomHex}.${ext}`;

    // 3. Upload to private 'payment-proofs' bucket
    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[AerobicsRenewalService] Upload failed:", uploadError);
      return {
        success: false,
        error: `Failed to upload payment screenshot: ${uploadError.message}. Please try again.`,
      };
    }

    // 4. Record pending payment request in Supabase 'payments' table
    // Maps method to database allowed check: 'CBE_BIRR' | 'TELEBIRR'
    const dbPaymentMethod = paymentMethod === "cbe_birr" ? "CBE_BIRR" : "TELEBIRR";
    const notes = `Aerobics renewal request for plan: ${plan.name} (${plan.id}). Payment proof uploaded, awaiting reception verification.`;

    const { data: paymentRow, error: paymentError } = await (supabase
      .from("payments") as any)
      .insert({
        customer_id: customerId,
        membership_id: membershipId || null,
        amount: plan.price,
        payment_method: dbPaymentMethod,
        payment_status: "PENDING",
        transaction_reference: storagePath,
        paid_at: null, // NOT paid yet — waiting for staff verification
        service_type: "MEMBERSHIP",
        notes,
      })
      .select("id")
      .single();

    if (paymentError) {
      console.error("[AerobicsRenewalService] Failed to record payment:", paymentError);
      // Clean up orphaned uploaded file on database insert failure
      await supabase.storage.from("payment-proofs").remove([storagePath]);
      return {
        success: false,
        error: `Failed to create payment verification request: ${paymentError.message}. Please try again.`,
      };
    }

    const insertedId = paymentRow ? (paymentRow as { id: string }).id : undefined;

    return {
      success: true,
      paymentId: insertedId,
      filePath: storagePath,
    };
  } catch (err: any) {
    console.error("[AerobicsRenewalService] Unexpected error during submission:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during payment submission.",
    };
  }
}

