import { supabase } from "../integrations/supabase/client";
import { validateProofFile, MAX_FILE_SIZE_BYTES } from "./regularRenewalService";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export { validateProofFile, MAX_FILE_SIZE_BYTES };

export interface SteamCatalogItem {
  id: string; // references public.services(id)
  type: "per-visit" | "package";
  name: string;
  price: number;
  visits: number;
  validityDays: number;
  validityLabel: string;
  description: string;
}

/**
 * Centralized customer catalog configuration.
 * Single source of truth for customer purchase pricing and metadata.
 * Note: Database public.services record has historical price 800 ETB for the 10-visit package;
 * the official customer portal pricing requirement is 1,200 ETB.
 */
export const STEAM_CATALOG: SteamCatalogItem[] = [
  {
    id: "22222222-2222-2222-2222-222222222202",
    type: "per-visit",
    name: "Single Session",
    price: 150,
    visits: 1,
    validityDays: 1,
    validityLabel: "Valid today",
    description: "One-off soap bath & steam room session",
  },
  {
    id: "22222222-2222-2222-2222-222222222201",
    type: "package",
    name: "10-Visit Package",
    price: 1200,
    visits: 10,
    validityDays: 30,
    validityLabel: "Valid for 30 days",
    description: "Bundle of 10 soap bath & steam sessions",
  },
];

export interface CustomerPendingSteamPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentMethod: "CBE_BIRR" | "TELEBIRR" | "CASH" | string;
  paymentStatus: "PENDING";
  serviceType: "STEAM";
  serviceId: string | null;
  transactionReference: string | null;
  productName: string;
  visits: number;
  createdAt: string;
  notes: string | null;
}

export interface SubmitSteamPaymentProofParams {
  customerId: string;
  serviceId: string;
  productType: "per-visit" | "package";
  amount: number;
  paymentMethod: "cbe_birr" | "telebirr";
  file: File;
}

export interface SubmitSteamPaymentProofResult {
  success: boolean;
  paymentId?: string;
  filePath?: string;
  error?: string;
}

/**
 * Returns the customer-facing Steam products catalog.
 */
export async function fetchSteamCatalog(): Promise<SteamCatalogItem[]> {
  return STEAM_CATALOG;
}

/**
 * Checks if the specific customer currently has an unverified PENDING Steam payment.
 * Strictly scoped to customer_id = customerId.
 */
export async function fetchCustomerPendingSteamPayment(
  customerId: string
): Promise<{ data: CustomerPendingSteamPayment | null; error: string | null }> {
  if (!customerId || !UUID_REGEX.test(customerId)) {
    return { data: null, error: "Invalid customer ID format. Expected a standard UUID." };
  }

  try {
    const { data, error } = await supabase
      .from("payments")
      .select("id, customer_id, amount, payment_method, payment_status, service_type, service_id, transaction_reference, notes, created_at")
      .eq("customer_id", customerId)
      .eq("service_type", "STEAM")
      .eq("payment_status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[SteamPurchaseService] Error fetching pending payment:", error);
      return { data: null, error: "Unable to verify pending payment status." };
    }

    if (!data) {
      return { data: null, error: null };
    }

    const row = data as unknown as {
      id: string;
      customer_id: string;
      amount: number;
      payment_method: string;
      payment_status: string;
      service_type: string;
      service_id: string | null;
      transaction_reference: string | null;
      notes: string | null;
      created_at: string;
    };

    const matchedItem = STEAM_CATALOG.find(i => i.id === row.service_id) ||
      (row.amount >= 1000 ? STEAM_CATALOG[1] : STEAM_CATALOG[0]);

    const pendingPayment: CustomerPendingSteamPayment = {
      id: row.id,
      customerId: row.customer_id,
      amount: Number(row.amount),
      paymentMethod: row.payment_method,
      paymentStatus: "PENDING",
      serviceType: "STEAM",
      serviceId: row.service_id ?? null,
      transactionReference: row.transaction_reference ?? null,
      productName: matchedItem.name,
      visits: matchedItem.visits,
      createdAt: row.created_at,
      notes: row.notes ?? null,
    };

    return { data: pendingPayment, error: null };
  } catch (err: any) {
    console.error("[SteamPurchaseService] Unexpected error in fetchCustomerPendingSteamPayment:", err);
    return { data: null, error: err?.message || "Unexpected error checking pending payments." };
  }
}

/**
 * Uploads a payment screenshot to private Supabase Storage 'payment-proofs' and
 * creates a PENDING payment record in public.payments.
 *
 * CRITICAL SAFETY RULES:
 * 1. payment_status is set to PENDING (never marked PAID).
 * 2. steam_access is NOT inserted or activated here.
 * 3. paid_at remains NULL.
 * 4. Screenshot stored in private 'payment-proofs' bucket.
 * 5. On DB insert failure, the uploaded file is rolled back from storage.
 */
export async function submitSteamPaymentProof(
  params: SubmitSteamPaymentProofParams
): Promise<SubmitSteamPaymentProofResult> {
  const { customerId, serviceId, productType, amount, paymentMethod, file } = params;

  // 1. Validate customer ID
  if (!customerId || !UUID_REGEX.test(customerId)) {
    return { success: false, error: "Invalid customer ID. Steam purchase rejected." };
  }

  // 2. Validate product item against catalog
  const catalogItem = STEAM_CATALOG.find(i => i.id === serviceId && i.type === productType);
  if (!catalogItem) {
    return { success: false, error: "Invalid Steam product selected. Purchase rejected." };
  }

  // Verify amount matches catalog
  if (amount !== catalogItem.price) {
    return { success: false, error: "Product price mismatch. Purchase rejected." };
  }

  // 3. Validate payment method
  if (paymentMethod !== "cbe_birr" && paymentMethod !== "telebirr") {
    return { success: false, error: "Invalid payment method. Only CBE and Telebirr accept proof uploads." };
  }

  // 4. Validate screenshot file
  const validation = validateProofFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error || "Invalid receipt image." };
  }

  // 5. Duplicate Pending Payment Check
  const pendingCheck = await fetchCustomerPendingSteamPayment(customerId);
  if (pendingCheck.data) {
    return {
      success: false,
      error: "You already have a Steam payment awaiting verification. Multiple pending submissions are not allowed.",
    };
  }

  // 6. Generate storage path and upload to 'payment-proofs'
  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
  const timestamp = Date.now();
  const randomHex = Math.random().toString(36).substring(2, 10);
  const storagePath = `proofs/${customerId}/${timestamp}_${randomHex}.${ext}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[SteamPurchaseService] Storage upload failed:", uploadError);
      return {
        success: false,
        error: `Failed to upload payment receipt: ${uploadError.message}. Please try again.`,
      };
    }

    // 7. Record PENDING payment in public.payments
    const dbPaymentMethod = paymentMethod === "cbe_birr" ? "CBE_BIRR" : "TELEBIRR";
    const notes = `Steam purchase request for ${catalogItem.name} (${catalogItem.visits} session(s) - ${catalogItem.price} ETB). Proof uploaded, awaiting reception verification.`;

    const { data: paymentRow, error: paymentError } = await (supabase
      .from("payments") as any)
      .insert({
        customer_id: customerId,
        membership_id: null,
        amount: catalogItem.price,
        payment_method: dbPaymentMethod,
        payment_status: "PENDING",
        transaction_reference: storagePath,
        paid_at: null, // NOT paid yet — waiting for staff verification
        service_type: "STEAM",
        service_id: catalogItem.id,
        notes,
      })
      .select("id")
      .single();

    if (paymentError) {
      console.error("[SteamPurchaseService] DB payment insert failed, rolling back storage:", paymentError);
      // Clean up orphaned uploaded file on database failure
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
    console.error("[SteamPurchaseService] Unexpected error during submission, rolling back:", err);
    // Cleanup if storage upload happened
    try {
      await supabase.storage.from("payment-proofs").remove([storagePath]);
    } catch {
      // ignore rollback errors
    }
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during Steam payment submission.",
    };
  }
}
