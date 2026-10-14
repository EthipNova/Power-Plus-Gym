import { supabase } from "../integrations/supabase/client";

export interface TrainerCoachingNote {
  id: string;
  trainerId: string;
  customerId: string;
  sessionDate: string;
  workoutFocus: string;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainerNoteParams {
  customerId: string;
  trainerId: string;
  workoutFocus: string;
  notes: string;
  sessionDate?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns current date string in Ethiopia local time (Africa/Addis_Ababa, UTC+3) as YYYY-MM-DD.
 */
export function getGymLocalDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split("T")[0];
  }
}

function isValidUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

function isValidDate(dateStr: string): boolean {
  return typeof dateStr === "string" && DATE_REGEX.test(dateStr.trim());
}

/**
 * Fetches coaching notes for a customer, newest first.
 * Relies on RLS to enforce trainer-trainee authorization and staff/owner privileges.
 */
export async function fetchTrainerNotes(customerId: string): Promise<TrainerCoachingNote[]> {
  if (!isValidUuid(customerId)) {
    throw new Error(`Invalid customer ID: "${customerId}"`);
  }

  const { data, error } = await supabase
    .from("trainer_coaching_notes")
    .select("id, trainer_id, customer_id, session_date, workout_focus, notes, created_by, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load coaching notes: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    trainerId: row.trainer_id,
    customerId: row.customer_id,
    sessionDate: row.session_date,
    workoutFocus: row.workout_focus,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Creates and persists a new coaching note for a customer.
 * Validates inputs and derives created_by from the authenticated user session.
 */
export async function createTrainerNote(params: CreateTrainerNoteParams): Promise<TrainerCoachingNote> {
  if (!isValidUuid(params.customerId)) {
    throw new Error(`Invalid customer ID: "${params.customerId}"`);
  }
  if (!isValidUuid(params.trainerId)) {
    throw new Error(`Invalid trainer profile ID: "${params.trainerId}"`);
  }

  const trimmedFocus = (params.workoutFocus || "").trim();
  if (!trimmedFocus) {
    throw new Error("Workout focus is required and cannot be empty.");
  }

  const trimmedNotes = (params.notes || "").trim();
  if (!trimmedNotes) {
    throw new Error("Coaching notes are required and cannot be empty.");
  }

  const sessionDate = params.sessionDate ? params.sessionDate.trim() : getGymLocalDateString();
  if (!isValidDate(sessionDate)) {
    throw new Error(`Invalid session date: "${sessionDate}". Must be YYYY-MM-DD format.`);
  }

  // Derive authenticated user
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error("Authentication required. Please log in as an active trainer to save coaching notes.");
  }
  const authenticatedUserId = authData.user.id;

  const payload = {
    trainer_id: params.trainerId,
    customer_id: params.customerId,
    session_date: sessionDate,
    workout_focus: trimmedFocus,
    notes: trimmedNotes,
    created_by: authenticatedUserId,
  };

  const { data, error } = await (supabase.from("trainer_coaching_notes") as any)
    .insert([payload])
    .select("id, trainer_id, customer_id, session_date, workout_focus, notes, created_by, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to save coaching note: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to save coaching note: No data returned from database.");
  }

  return {
    id: data.id,
    trainerId: data.trainer_id,
    customerId: data.customer_id,
    sessionDate: data.session_date,
    workoutFocus: data.workout_focus,
    notes: data.notes,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
