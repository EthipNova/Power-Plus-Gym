import { supabase } from "../integrations/supabase/client";

export interface AerobicsCustomerProfile {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string | null;
  customerType: string;
  status: string;
  joinDate: string;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
}

export type AerobicsProfileState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "not_found"; message: string }
  | { status: "success"; data: AerobicsCustomerProfile };

export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
}

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
  data?: AerobicsCustomerProfile;
}

interface CustomerDbRow {
  id: string;
  customer_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  customer_type: string;
  status: string;
  join_date: string;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapDbRowToProfile(row: CustomerDbRow): AerobicsCustomerProfile {
  return {
    id: row.id,
    customerCode: row.customer_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    phone: row.phone,
    email: row.email ?? null,
    customerType: row.customer_type,
    status: row.status,
    joinDate: row.join_date,
    dateOfBirth: row.date_of_birth ?? null,
    gender: row.gender ?? null,
    address: row.address ?? null,
  };
}

/**
 * Retrieves the real customer profile from Supabase.
 * Validates UUID prior to issuing queries.
 */
export async function fetchAerobicsProfile(customerId: string): Promise<AerobicsProfileState> {
  if (!customerId || !UUID_REGEX.test(customerId)) {
    return {
      status: "error",
      error: "Invalid customer ID format. Expected a standard UUID.",
    };
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_code, first_name, last_name, phone, email, customer_type, status, join_date, date_of_birth, gender, address")
      .eq("id", customerId)
      .maybeSingle();

    if (error) {
      console.error("[AerobicsProfileService] Error fetching customer profile:", error);
      return {
        status: "error",
        error: "Unable to load customer profile from database. Please check your connection.",
      };
    }

    if (!data) {
      return {
        status: "not_found",
        message: "Customer profile not found in database.",
      };
    }

    const profile = mapDbRowToProfile(data as CustomerDbRow);
    return {
      status: "success",
      data: profile,
    };
  } catch (err: any) {
    console.error("[AerobicsProfileService] Unexpected error fetching profile:", err);
    return {
      status: "error",
      error: err?.message || "An unexpected error occurred while loading your profile.",
    };
  }
}

/**
 * Updates safe, customer-editable fields in Supabase 'customers' table.
 * Strictly whitelist-controlled:
 * - Allows: first_name, last_name, phone, date_of_birth, gender, address
 * - Forbids: id, customer_code, customer_type, status, join_date, user_id, email
 */
export async function updateAerobicsProfile(
  customerId: string,
  payload: UpdateProfilePayload
): Promise<UpdateProfileResult> {
  if (!customerId || !UUID_REGEX.test(customerId)) {
    return {
      success: false,
      error: "Invalid customer ID format. Expected a standard UUID.",
    };
  }

  const cleanFirstName = payload.firstName ? payload.firstName.trim() : "";
  const cleanLastName = payload.lastName ? payload.lastName.trim() : "";
  const cleanPhone = payload.phone ? payload.phone.trim() : "";

  if (!cleanFirstName) {
    return { success: false, error: "First name is required." };
  }

  if (!cleanLastName) {
    return { success: false, error: "Last name is required." };
  }

  if (!cleanPhone) {
    return { success: false, error: "Phone number is required." };
  }

  // Construct whitelist-only database payload
  const dbPayload = {
    first_name: cleanFirstName,
    last_name: cleanLastName,
    phone: cleanPhone,
    date_of_birth: payload.dateOfBirth ? payload.dateOfBirth.trim() || null : null,
    gender: payload.gender ? payload.gender.trim() || null : null,
    address: payload.address ? payload.address.trim() || null : null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase.from("customers") as any)
      .update(dbPayload)
      .eq("id", customerId)
      .select("id, customer_code, first_name, last_name, phone, email, customer_type, status, join_date, date_of_birth, gender, address")
      .single();

    if (error) {
      console.error("[AerobicsProfileService] Supabase update failed:", error);

      // Handle PostgreSQL unique constraint violation on phone gracefully
      if (error.code === "23505" || error.message?.includes("customers_phone_key") || error.details?.includes("phone")) {
        return {
          success: false,
          error: "This phone number is already registered to another member. Please enter a different phone number.",
        };
      }

      return {
        success: false,
        error: `Failed to update profile: ${error.message}`,
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Customer record not found for update.",
      };
    }

    return {
      success: true,
      data: mapDbRowToProfile(data as CustomerDbRow),
    };
  } catch (err: any) {
    console.error("[AerobicsProfileService] Unexpected error updating profile:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while saving your profile.",
    };
  }
}
