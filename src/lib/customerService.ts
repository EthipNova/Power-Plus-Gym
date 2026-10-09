import { supabase } from "@/integrations/supabase/client";
import type { CustomerCategory, Member } from "@/types";

export interface CustomerRegistrationInput {
  name: string;
  phone: string;
  email: string;
  category: CustomerCategory;
  planId: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  studentId?: string;
  institution?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d+\-\s()]{7,25}$/;

/**
 * Validates customer registration inputs (both frontend and backend).
 * Enforces: Full Name, Phone Number, and Email Address as strictly required.
 */
export function validateCustomerInput(input: CustomerRegistrationInput): ValidationResult {
  const errors: Record<string, string> = {};

  const trimmedName = input.name ? input.name.trim() : "";
  if (!trimmedName) {
    errors.name = "Full name is required";
  } else if (trimmedName.length < 2) {
    errors.name = "Full name must be at least 2 characters";
  }

  const trimmedPhone = input.phone ? input.phone.trim() : "";
  if (!trimmedPhone) {
    errors.phone = "Phone number is required";
  } else if (!PHONE_REGEX.test(trimmedPhone)) {
    errors.phone = "Please enter a valid phone number (at least 7 digits)";
  }

  const trimmedEmail = input.email ? input.email.trim() : "";
  if (!trimmedEmail) {
    errors.email = "Email address is required";
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = "Please enter a valid email address (e.g. member@example.com)";
  }

  if (!input.planId) {
    errors.planId = "Membership plan is required";
  }

  if (input.category === "STUDENT") {
    if (!input.studentId?.trim()) {
      errors.studentId = "Student ID number is required for student category";
    }
    if (!input.institution?.trim()) {
      errors.institution = "Institution name is required for student category";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Checks for existing customer by phone number or email in both local state and Supabase.
 */
export async function checkCustomerDuplicate(
  phone: string,
  email: string,
  localMembers: Member[] = []
): Promise<{ isDuplicate: boolean; reason?: string }> {
  const cleanPhone = phone.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 1. Check local state
  const localPhoneDup = localMembers.find(m => m.phone.trim() === cleanPhone);
  if (localPhoneDup) {
    return {
      isDuplicate: true,
      reason: `Phone number is already registered to ${localPhoneDup.name} (${localPhoneDup.memberId})`,
    };
  }

  const localEmailDup = localMembers.find(m => m.email.trim().toLowerCase() === cleanEmail);
  if (localEmailDup) {
    return {
      isDuplicate: true,
      reason: `Email address is already registered to ${localEmailDup.name} (${localEmailDup.memberId})`,
    };
  }

  // 2. Check Supabase 'customers' table
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_code, first_name, last_name, phone, email")
      .or(`phone.eq.${cleanPhone},email.ilike.${cleanEmail}`);

    if (error) {
      console.warn("Could not query customer duplicates in database:", error.message);
      return { isDuplicate: false };
    }

    if (data && data.length > 0) {
      for (const row of data) {
        const rowName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.customer_code;
        if (row.phone && row.phone.trim() === cleanPhone) {
          return {
            isDuplicate: true,
            reason: `Phone number is already registered in database (${rowName} - ${row.customer_code})`,
          };
        }
        if (row.email && row.email.trim().toLowerCase() === cleanEmail) {
          return {
            isDuplicate: true,
            reason: `Email address is already registered in database (${rowName} - ${row.customer_code})`,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Error checking customer duplicates in database:", err);
  }

  return { isDuplicate: false };
}

/**
 * Generates the next customer code (e.g., PP-009) taking into account both local state and remote database.
 */
export async function getNextCustomerCode(localMembers: Member[] = []): Promise<string> {
  const existingCodes = new Set<string>();
  localMembers.forEach(m => {
    if (m.memberId) existingCodes.add(m.memberId);
  });

  try {
    const { data } = await supabase
      .from("customers")
      .select("customer_code")
      .order("customer_code", { ascending: false })
      .limit(50);

    if (data) {
      data.forEach(r => {
        if (r.customer_code) existingCodes.add(r.customer_code);
      });
    }
  } catch (err) {
    console.warn("Could not fetch customer codes from database:", err);
  }

  const numbers: number[] = [];
  existingCodes.forEach(code => {
    const match = code.match(/^PP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 900) {
        numbers.push(num);
      }
    }
  });

  let nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  while (existingCodes.has(`PP-${String(nextNum).padStart(3, "0")}`)) {
    nextNum++;
  }

  return `PP-${String(nextNum).padStart(3, "0")}`;
}

/**
 * Saves a new customer record to the Supabase 'customers' table with strict backend validation.
 */
export async function saveCustomerToDatabase(
  input: CustomerRegistrationInput,
  code: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  // 1. Strict validation check
  const validation = validateCustomerInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || "Invalid input";
    return { success: false, error: firstErr };
  }

  // 2. Parse first name and last name
  const nameParts = input.name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];

  const notesList = [
    input.emergencyContact ? `Emergency Contact: ${input.emergencyContact} (${input.emergencyPhone || "No phone"})` : "",
    input.medicalNotes ? `Medical Notes: ${input.medicalNotes}` : "",
    input.planId ? `Plan ID: ${input.planId}` : "",
    input.category === "STUDENT" && input.studentId ? `Student ID: ${input.studentId} (${input.institution || "N/A"})` : "",
  ].filter(Boolean);

  const payload = {
    id: crypto.randomUUID(),
    customer_code: code,
    first_name: firstName,
    last_name: lastName,
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    status: "ACTIVE",
    customer_type: input.category || "REGULAR",
    notes: notesList.join(" | ") || null,
    join_date: new Date().toISOString().split("T")[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("customers_phone_key")) {
        return { success: false, error: "A customer with this phone number already exists in the database." };
      }
      if (error.message.includes("idx_customers_email_unique") || error.message.includes("email")) {
        return { success: false, error: "A customer with this email address already exists in the database." };
      }
      if (error.message.includes("customer_code")) {
        return { success: false, error: "Customer code conflict occurred. Please try again." };
      }
      return { success: false, error: "A duplicate customer record already exists in the database." };
    }
    return { success: false, error: error.message || "Failed to save customer to database." };
  }

  return { success: true, data };
}
