import { supabase } from "../integrations/supabase/client";

export type SessionAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface SessionAttendanceRecord {
  id: string;
  sessionId: string;
  customerId: string;
  attendanceDate: string;
  status: SessionAttendanceStatus;
  recordedBy: string | null;
  recordedAt: string;
  updatedAt: string;
  notes: string | null;
}

export interface EnrolledTrainee {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  aerobicsGroupId: string | null;
}

export interface TraineeAttendanceItem {
  trainee: EnrolledTrainee;
  status: SessionAttendanceStatus | "UNRECORDED";
  recordId: string | null;
  recordedAt: string | null;
  notes: string | null;
}

export interface SessionRosterResult {
  sessionId: string;
  attendanceDate: string;
  items: TraineeAttendanceItem[];
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  unrecordedCount: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES: SessionAttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

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

/**
 * Validates a UUID string.
 */
function isValidUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

/**
 * Validates a YYYY-MM-DD date string.
 */
function isValidDate(dateStr: string): boolean {
  return typeof dateStr === "string" && DATE_REGEX.test(dateStr.trim());
}

/**
 * Validates attendance status.
 */
function isValidStatus(status: string): status is SessionAttendanceStatus {
  return VALID_STATUSES.includes(status as SessionAttendanceStatus);
}

/**
 * Fetches enrolled customers for a given aerobics session.
 */
export async function fetchEnrolledTrainees(sessionId: string): Promise<EnrolledTrainee[]> {
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session ID: "${sessionId}"`);
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, first_name, last_name, phone, email, status, aerobics_group_id")
    .eq("aerobics_group_id", sessionId)
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load enrolled trainees: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    customerCode: row.customer_code,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    fullName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.customer_code,
    phone: row.phone || null,
    email: row.email || null,
    status: row.status || "ACTIVE",
    aerobicsGroupId: row.aerobics_group_id,
  }));
}

/**
 * Fetches existing attendance records for a session and date.
 */
export async function fetchSessionAttendance(
  sessionId: string,
  attendanceDate: string
): Promise<SessionAttendanceRecord[]> {
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session ID: "${sessionId}"`);
  }
  if (!isValidDate(attendanceDate)) {
    throw new Error(`Invalid attendance date: "${attendanceDate}". Format must be YYYY-MM-DD.`);
  }

  const { data, error } = await supabase
    .from("session_attendance")
    .select("id, session_id, customer_id, attendance_date, status, recorded_by, recorded_at, updated_at, notes")
    .eq("session_id", sessionId)
    .eq("attendance_date", attendanceDate);

  if (error) {
    throw new Error(`Failed to fetch session attendance: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    customerId: row.customer_id,
    attendanceDate: row.attendance_date,
    status: row.status as SessionAttendanceStatus,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
    notes: row.notes,
  }));
}

/**
 * Fetches full session roster combined with attendance records for a given date.
 */
export async function fetchSessionRosterWithAttendance(
  sessionId: string,
  attendanceDate: string
): Promise<SessionRosterResult> {
  const [trainees, attendanceRecords] = await Promise.all([
    fetchEnrolledTrainees(sessionId),
    fetchSessionAttendance(sessionId, attendanceDate),
  ]);

  const attendanceByCustomer = new Map<string, SessionAttendanceRecord>();
  for (const record of attendanceRecords) {
    attendanceByCustomer.set(record.customerId, record);
  }

  let presentCount = 0;
  let absentCount = 0;
  let unrecordedCount = 0;

  const items: TraineeAttendanceItem[] = trainees.map((trainee) => {
    const record = attendanceByCustomer.get(trainee.id);
    if (!record) {
      unrecordedCount++;
      return {
        trainee,
        status: "UNRECORDED",
        recordId: null,
        recordedAt: null,
        notes: null,
      };
    }

    if (record.status === "PRESENT") presentCount++;
    else if (record.status === "ABSENT") absentCount++;

    return {
      trainee,
      status: record.status,
      recordId: record.id,
      recordedAt: record.recordedAt,
      notes: record.notes,
    };
  });

  return {
    sessionId,
    attendanceDate,
    items,
    totalEnrolled: trainees.length,
    presentCount,
    absentCount,
    unrecordedCount,
  };
}

export interface RecordAttendanceParams {
  sessionId: string;
  customerId: string;
  attendanceDate: string;
  status: SessionAttendanceStatus;
  notes?: string | null;
}

/**
 * Upserts a session attendance record using the unique constraint (session_id, customer_id, attendance_date).
 * Ensures recorded_by is derived from the authenticated identity.
 */
export async function recordSessionAttendance(
  params: RecordAttendanceParams
): Promise<SessionAttendanceRecord> {
  if (!isValidUuid(params.sessionId)) {
    throw new Error(`Invalid session ID: "${params.sessionId}"`);
  }
  if (!isValidUuid(params.customerId)) {
    throw new Error(`Invalid customer ID: "${params.customerId}"`);
  }
  if (!isValidDate(params.attendanceDate)) {
    throw new Error(`Invalid attendance date: "${params.attendanceDate}". Format must be YYYY-MM-DD.`);
  }
  if (!isValidStatus(params.status)) {
    throw new Error(`Invalid attendance status: "${params.status}". Allowed: ${VALID_STATUSES.join(", ")}`);
  }

  // Retrieve authenticated user
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error("Authentication required. Please log in to record session attendance.");
  }
  const authenticatedUserId = authData.user.id;

  const payload = {
    session_id: params.sessionId,
    customer_id: params.customerId,
    attendance_date: params.attendanceDate,
    status: params.status,
    recorded_by: authenticatedUserId,
    notes: params.notes ?? null,
    recorded_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase.from("session_attendance") as any)
    .upsert(payload, {
      onConflict: "session_id,customer_id,attendance_date",
    })
    .select("id, session_id, customer_id, attendance_date, status, recorded_by, recorded_at, updated_at, notes")
    .single();

  if (error) {
    throw new Error(`Failed to save attendance: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to save attendance: No record returned.");
  }

  const row = data as {
    id: string;
    session_id: string;
    customer_id: string;
    attendance_date: string;
    status: string;
    recorded_by: string | null;
    recorded_at: string;
    updated_at: string;
    notes: string | null;
  };

  return {
    id: row.id,
    sessionId: row.session_id,
    customerId: row.customer_id,
    attendanceDate: row.attendance_date,
    status: row.status as SessionAttendanceStatus,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
    notes: row.notes,
  };
}
