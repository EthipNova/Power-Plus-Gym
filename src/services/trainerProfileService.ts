import { supabase } from "../integrations/supabase/client";

export interface RealTrainerProfile {
  id: string; // Database UUID from public.trainer_profiles.id
  userId: string; // Supabase Auth UID
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  specialization: string | null;
  specialties: string[];
  isActive: boolean;
  email: string | null;
}

export interface RealTrainerSession {
  id: string;
  name: string;
  days: string[];
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  timeSlot: string;
  capacity: number;
  status: string;
  description: string | null;
  active: boolean;
  enrolledCount: number;
  durationHours: number;
}

export interface RealTrainerTrainee {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  sessionId: string;
  sessionName: string;
}

export type TrainerProfileState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "not_found"; message: string }
  | {
      status: "success";
      profile: RealTrainerProfile;
      sessions: RealTrainerSession[];
      trainees: RealTrainerTrainee[];
      weeklyHours: number;
    };

interface DbTrainerProfileRow {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  specialization: string | null;
  is_active: boolean;
}

interface DbAerobicsSessionRow {
  id: string;
  name: string;
  days: string[] | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  status: string | null;
  description: string | null;
  active: boolean | null;
}

interface DbCustomerRow {
  id: string;
  customer_code: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  aerobics_group_id: string | null;
}

function calculateDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 1;
  try {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return diff > 0 ? diff / 60 : 1;
  } catch {
    return 1;
  }
}

/**
 * Fetches the real trainer profile, assigned sessions, and enrolled trainees from Supabase.
 * Respects RLS and uses authenticated user ID.
 */
export async function fetchTrainerProfileData(userId: string): Promise<TrainerProfileState> {
  if (!userId) {
    return { status: "not_found", message: "User ID is required." };
  }

  try {
    // 1. Fetch trainer profile from public.trainer_profiles
    const pRes = await supabase
      .from("trainer_profiles")
      .select("id, user_id, first_name, last_name, phone, specialization, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (pRes.error) {
      console.error("[TrainerProfileService] Error querying trainer_profiles:", pRes.error);
      return { status: "error", error: pRes.error.message };
    }

    const profileRow = (pRes.data as unknown) as DbTrainerProfileRow | null;
    if (!profileRow) {
      return { status: "not_found", message: "No trainer profile found for this user account." };
    }

    // 2. Resolve email from Supabase Auth or users table
    const { data: authData } = await supabase.auth.getUser();
    let email = authData?.user?.email || null;
    if (!email) {
      const uRes = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
      const uRow = uRes.data as { email: string | null } | null;
      email = uRow?.email || null;
    }

    const specialties = profileRow.specialization
      ? profileRow.specialization
          .split(/[&,]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    const profile: RealTrainerProfile = {
      id: profileRow.id,
      userId: profileRow.user_id,
      firstName: profileRow.first_name || "",
      lastName: profileRow.last_name || "",
      fullName: `${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim() || "Trainer",
      phone: profileRow.phone ?? null,
      specialization: profileRow.specialization ?? null,
      specialties,
      isActive: Boolean(profileRow.is_active),
      email,
    };

    // 3. Retrieve sessions assigned to this trainer (from public.aerobics_sessions)
    const sRes = await supabase
      .from("aerobics_sessions")
      .select("id, name, days, day_of_week, start_time, end_time, capacity, status, description, active")
      .eq("trainer_id", profile.id);

    if (sRes.error) {
      console.warn("[TrainerProfileService] Error fetching aerobics_sessions:", sRes.error);
    }

    const sessionRows = (sRes.data as unknown) as DbAerobicsSessionRow[] | null;
    const sessions: RealTrainerSession[] = [];
    const trainees: RealTrainerTrainee[] = [];
    let totalWeeklyHours = 0;

    if (sessionRows && sessionRows.length > 0) {
      const sessionIds = sessionRows.map((s) => s.id);

      // 4. Retrieve customers enrolled in these sessions
      const cRes = await supabase
        .from("customers")
        .select("id, customer_code, first_name, last_name, phone, email, aerobics_group_id")
        .in("aerobics_group_id", sessionIds);

      if (cRes.error) {
        console.warn("[TrainerProfileService] Error fetching enrolled trainees:", cRes.error);
      }

      const customerRows = (cRes.data as unknown) as DbCustomerRow[] | null;
      const enrolledBySession: Record<string, number> = {};
      if (customerRows) {
        for (const cust of customerRows) {
          const sId = cust.aerobics_group_id;
          if (sId) {
            enrolledBySession[sId] = (enrolledBySession[sId] || 0) + 1;
            const parentSession = sessionRows.find((s) => s.id === sId);
            trainees.push({
              id: cust.id,
              customerCode: cust.customer_code,
              firstName: cust.first_name || "",
              lastName: cust.last_name || "",
              fullName: `${cust.first_name || ""} ${cust.last_name || ""}`.trim() || "Member",
              phone: cust.phone ?? null,
              email: cust.email ?? null,
              sessionId: sId,
              sessionName: parentSession?.name || "Group Session",
            });
          }
        }
      }

      for (const s of sessionRows) {
        const rawDays: string[] = Array.isArray(s.days) && s.days.length > 0
          ? s.days
          : [];

        const startStr = (s.start_time || "").slice(0, 5);
        const endStr = (s.end_time || "").slice(0, 5);
        const timeSlot = startStr && endStr ? `${startStr} - ${endStr}` : startStr || "—";
        const duration = calculateDurationHours(s.start_time, s.end_time);
        const occurrencesPerWeek = rawDays.length > 0 ? rawDays.length : 1;
        totalWeeklyHours += duration * occurrencesPerWeek;

        sessions.push({
          id: s.id,
          name: s.name,
          days: rawDays,
          dayOfWeek: s.day_of_week ?? null,
          startTime: s.start_time,
          endTime: s.end_time,
          timeSlot,
          capacity: s.capacity ?? 0,
          status: s.status || "ACTIVE",
          description: s.description ?? null,
          active: Boolean(s.active),
          enrolledCount: enrolledBySession[s.id] || 0,
          durationHours: duration,
        });
      }
    }

    return {
      status: "success",
      profile,
      sessions,
      trainees,
      weeklyHours: Math.round(totalWeeklyHours * 10) / 10,
    };
  } catch (err: any) {
    console.error("[TrainerProfileService] Unexpected error:", err);
    return {
      status: "error",
      error: err?.message || "Failed to load trainer profile data.",
    };
  }
}
