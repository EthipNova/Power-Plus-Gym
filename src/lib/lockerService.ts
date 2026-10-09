import { supabase } from "@/integrations/supabase/client";
import type { Locker, LockerAssignment, LockerStatus, Member } from "@/types";

export const LOCAL_LOCKERS_KEY = "powerplus_lockers";
export const LOCAL_ASSIGNMENTS_KEY = "powerplus_locker_assignments";

/**
 * Default fallback locker inventory if database has no rows yet.
 */
export const DEFAULT_LOCKERS: Locker[] = [
  { id: "77777777-7777-7777-7777-777777777701", number: "101", keyTag: "K-101", status: "AVAILABLE", notes: "Ground floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777702", number: "102", keyTag: "K-102", status: "AVAILABLE", notes: "Ground floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777703", number: "103", keyTag: "K-103", status: "AVAILABLE", notes: "Ground floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777704", number: "104", keyTag: "K-104", status: "AVAILABLE", notes: "Ground floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777705", number: "105", keyTag: "K-105", status: "AVAILABLE", notes: "Ground floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777706", number: "106", keyTag: "K-106", status: "AVAILABLE", notes: "First floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777707", number: "107", keyTag: "K-107", status: "AVAILABLE", notes: "First floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777708", number: "108", keyTag: "K-108", status: "AVAILABLE", notes: "First floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777709", number: "109", keyTag: "K-109", status: "AVAILABLE", notes: "First floor", createdAt: "2026-10-01" },
  { id: "77777777-7777-7777-7777-777777777710", number: "110", keyTag: "K-110", status: "AVAILABLE", notes: "First floor", createdAt: "2026-10-01" },
];

/**
 * Gets lockers stored in localStorage.
 */
export function getLocalLockers(): Locker[] {
  if (typeof window === "undefined") return DEFAULT_LOCKERS;
  try {
    const raw = localStorage.getItem(LOCAL_LOCKERS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_LOCKERS;
  } catch {
    return DEFAULT_LOCKERS;
  }
}

/**
 * Saves lockers to localStorage.
 */
export function saveLocalLockers(lockers: Locker[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_LOCKERS_KEY, JSON.stringify(lockers));
  } catch (err) {
    console.warn("Could not save lockers to localStorage:", err);
  }
}

/**
 * Gets locker assignments stored in localStorage.
 */
export function getLocalAssignments(): LockerAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves locker assignments to localStorage.
 */
export function saveLocalAssignments(assignments: LockerAssignment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch (err) {
    console.warn("Could not save assignments to localStorage:", err);
  }
}

/**
 * Extracts key recipient name from assignment notes or returns fallback.
 */
export function extractKeyRecipient(notes: string | null | undefined, fallbackName: string): string {
  if (!notes) return fallbackName;
  const match = notes.match(/Key Recipient:\s*([^|]+)/i);
  return match ? match[1].trim() : fallbackName;
}

/**
 * Fetches real lockers and assignments directly from Supabase.
 * Merges with registered customers for accurate member names.
 */
export async function fetchLockersAndAssignments(): Promise<{
  lockers: Locker[];
  assignments: LockerAssignment[];
}> {
  try {
    // 1. Fetch lockers from database
    const { data: dbLockers, error: lErr } = await supabase
      .from("lockers")
      .select("*")
      .order("locker_number", { ascending: true });

    if (lErr) {
      console.warn("Notice fetching lockers from database:", lErr.message);
    }

    // 2. Fetch assignments from database
    const { data: dbAssignments, error: aErr } = await supabase
      .from("locker_assignments")
      .select("*")
      .order("assigned_at", { ascending: false });

    if (aErr) {
      console.warn("Notice fetching locker assignments from database:", aErr.message);
    }

    // 3. Fetch customers to link member names
    const { data: dbCustomers } = await supabase
      .from("customers")
      .select("id, customer_code, first_name, last_name, phone");

    const customerMap = new Map<string, string>();
    if (dbCustomers) {
      dbCustomers.forEach(c => {
        const name = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.customer_code;
        customerMap.set(c.id, name);
        customerMap.set(c.customer_code, name);
      });
    }

    // Build mapped lockers
    let lockers: Locker[] = [];
    if (dbLockers && dbLockers.length > 0) {
      lockers = dbLockers.map(r => ({
        id: r.id,
        number: r.locker_number || "—",
        keyTag: r.key_number || "",
        status: (r.status?.toUpperCase() as LockerStatus) || "AVAILABLE",
        notes: r.notes || "",
        createdAt: r.created_at ? r.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
        updatedAt: r.updated_at,
      }));
    } else {
      lockers = getLocalLockers();
    }

    // Build mapped assignments
    let assignments: LockerAssignment[] = [];
    if (dbAssignments && dbAssignments.length > 0) {
      assignments = dbAssignments.map(a => {
        const memberName = customerMap.get(a.customer_id) || "Member";
        const keyRecipient = a.key_recipient || extractKeyRecipient(a.notes, memberName);
        return {
          id: a.id,
          lockerId: a.locker_id,
          memberId: a.customer_id,
          memberName,
          assignedAt: a.assigned_at,
          dueDate: a.notes?.includes("Due:") ? a.notes.split("Due:")[1]?.trim() : null,
          returnedAt: a.returned_at || null,
          status: (a.status as any) || "active",
          keyReturned: a.status === "returned",
          lostKeyFee: 0,
          issuedBy: a.notes?.includes("Issued by:") ? a.notes.split("Issued by:")[1]?.split("|")[0]?.trim() : "Staff",
          notes: a.notes || "",
          keyRecipient,
        };
      });
    } else {
      assignments = getLocalAssignments();
    }

    // Synchronize localStorage
    saveLocalLockers(lockers);
    saveLocalAssignments(assignments);

    return { lockers, assignments };
  } catch (err) {
    console.warn("fetchLockersAndAssignments exception:", err);
    return {
      lockers: getLocalLockers(),
      assignments: getLocalAssignments(),
    };
  }
}

/**
 * Creates a new locker in the database and persists locally.
 */
/**
 * Creates a new locker in the database and persists locally.
 */
export async function createLockerInDatabase(params: {
  number: string;
  keyTag?: string;
  notes?: string;
  status?: LockerStatus;
  actor?: string;
}): Promise<{ success: boolean; locker: Locker; error?: string }> {
  const number = params.number.trim();
  if (!number) {
    return { success: false, locker: {} as Locker, error: "Locker number is required" };
  }

  const currentLockers = getLocalLockers();
  const duplicate = currentLockers.find(l => l.number.toLowerCase() === number.toLowerCase());
  if (duplicate) {
    return { success: false, locker: {} as Locker, error: `Locker ${number} already exists` };
  }

  const lockerId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const newLocker: Locker = {
    id: lockerId,
    number,
    keyTag: params.keyTag?.trim() || `K-${number}`,
    status: params.status || "AVAILABLE",
    notes: params.notes?.trim() || "",
    createdAt: nowIso.split("T")[0],
    updatedAt: nowIso,
  };

  // 1. Attempt insert in Supabase
  try {
    const { error: dbErr } = await supabase.from("lockers").insert({
      id: lockerId,
      locker_number: number,
      key_number: newLocker.keyTag,
      status: newLocker.status,
      notes: newLocker.notes,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (dbErr) {
      console.warn("Notice on inserting locker to Supabase:", dbErr.message);
    }
  } catch (err) {
    console.warn("Could not insert locker to Supabase:", err);
  }

  // 2. Persist in localStorage
  const updatedList = [...currentLockers, newLocker];
  saveLocalLockers(updatedList);

  return { success: true, locker: newLocker };
}

/**
 * Edits an existing locker in the database and persists locally.
 * Supports both updateLockerInDatabase(id, updates) and updateLockerInDatabase({ id, ...updates }).
 */
export async function updateLockerInDatabase(
  idOrParams: string | { id: string; number?: string; keyTag?: string; notes?: string; status?: LockerStatus; actor?: string },
  maybeParams?: { number?: string; keyTag?: string; notes?: string; status?: LockerStatus; actor?: string }
): Promise<{ success: boolean; locker: Locker; error?: string }> {
  const id = typeof idOrParams === "string" ? idOrParams : idOrParams.id;
  const params = typeof idOrParams === "string" ? (maybeParams || {}) : idOrParams;

  const currentLockers = getLocalLockers();
  const existingIndex = currentLockers.findIndex(l => l.id === id);
  if (existingIndex === -1) {
    return { success: false, locker: {} as Locker, error: "Locker not found" };
  }

  const existing = currentLockers[existingIndex];
  const trimmedNumber = params.number !== undefined ? params.number.trim() : existing.number;
  if (!trimmedNumber) {
    return { success: false, locker: {} as Locker, error: "Locker number is required" };
  }

  // Check if changing to a number that another locker already uses
  const duplicate = currentLockers.find(l => l.id !== id && l.number.toLowerCase() === trimmedNumber.toLowerCase());
  if (duplicate) {
    return { success: false, locker: {} as Locker, error: `Locker ${trimmedNumber} is already in use by another locker` };
  }

  const nowIso = new Date().toISOString();

  const updatedLocker: Locker = {
    ...existing,
    number: trimmedNumber,
    keyTag: params.keyTag !== undefined ? params.keyTag.trim() : existing.keyTag,
    notes: params.notes !== undefined ? params.notes.trim() : existing.notes,
    status: params.status || existing.status,
    updatedAt: nowIso,
  };

  // 1. Update in Supabase
  try {
    const { error: dbErr } = await supabase
      .from("lockers")
      .update({
        locker_number: updatedLocker.number,
        key_number: updatedLocker.keyTag,
        notes: updatedLocker.notes,
        status: updatedLocker.status,
        updated_at: nowIso,
      })
      .eq("id", id);

    if (dbErr) {
      console.warn("Notice on updating locker in Supabase:", dbErr.message);
    }
  } catch (err) {
    console.warn("Could not update locker in Supabase:", err);
  }

  // 2. Update in localStorage
  currentLockers[existingIndex] = updatedLocker;
  saveLocalLockers(currentLockers);

  return { success: true, locker: updatedLocker };
}

/**
 * Assigns a locker to a member, records who received the key,
 * sets locker to IN_USE, and stores the assignment in the database.
 */
export async function assignLockerInDatabase(params: {
  locker?: Locker;
  lockerId?: string;
  member?: Member;
  memberId?: string;
  memberName?: string;
  actor: string;
  keyRecipient?: string;
  dueDate?: string | null;
  notes?: string;
}): Promise<{
  success: boolean;
  assignment: LockerAssignment;
  updatedLocker: Locker;
  error?: string;
}> {
  const currentLockers = getLocalLockers();
  const lockerId = params.locker?.id || params.lockerId;
  const locker = params.locker || currentLockers.find(l => l.id === lockerId);

  if (!locker) {
    return {
      success: false,
      assignment: {} as LockerAssignment,
      updatedLocker: {} as Locker,
      error: "Locker not found.",
    };
  }

  // Verify locker is available
  if (locker.status !== "AVAILABLE") {
    return {
      success: false,
      assignment: {} as LockerAssignment,
      updatedLocker: locker,
      error: `Locker ${locker.number} is currently ${locker.status.toLowerCase().replace(/_/g, " ")} and cannot be assigned.`,
    };
  }

  const memberId = params.member?.id || params.memberId || "";
  const memberName = params.member?.name || params.memberName || "Member";

  const currentAssignments = getLocalAssignments();
  // Check if member already holds an active locker
  if (memberId) {
    const memberActive = currentAssignments.find(a => a.memberId === memberId && a.status === "active");
    if (memberActive) {
      return {
        success: false,
        assignment: {} as LockerAssignment,
        updatedLocker: locker,
        error: `${memberName} already holds active locker assignment.`,
      };
    }
  }

  const actor = params.actor || "Staff";
  const recipientName = params.keyRecipient?.trim() || memberName;
  const assignmentId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const notesCombined = [
    `Key Recipient: ${recipientName}`,
    `Issued by: ${actor}`,
    params.dueDate ? `Due: ${params.dueDate}` : "",
    params.notes?.trim() ? `Note: ${params.notes.trim()}` : "",
  ].filter(Boolean).join(" | ");

  const assignment: LockerAssignment = {
    id: assignmentId,
    lockerId: locker.id,
    memberId,
    memberName,
    assignedAt: nowIso,
    dueDate: params.dueDate || null,
    returnedAt: null,
    status: "active",
    keyReturned: false,
    lostKeyFee: 0,
    issuedBy: actor,
    notes: notesCombined,
    keyRecipient: recipientName,
  };

  const updatedLocker: Locker = {
    ...locker,
    status: "IN_USE",
    updatedAt: nowIso,
  };

  // 1. Update locker in database to IN_USE
  try {
    await supabase
      .from("lockers")
      .update({
        status: "IN_USE",
        updated_at: nowIso,
      })
      .eq("id", locker.id);
  } catch (err) {
    console.warn("Could not update locker status in Supabase:", err);
  }

  // 2. Insert assignment in database
  try {
    const payload: Record<string, any> = {
      id: assignmentId,
      locker_id: locker.id,
      customer_id: memberId,
      assigned_at: nowIso,
      status: "active",
      notes: notesCombined,
      key_recipient: recipientName,
    };
    const { error: aErr } = await supabase.from("locker_assignments").insert(payload);
    if (aErr) {
      if (aErr.message.includes("key_recipient")) {
        delete payload.key_recipient;
        const { error: retryErr } = await supabase.from("locker_assignments").insert(payload);
        if (retryErr) {
          console.warn("Notice inserting locker assignment to Supabase:", retryErr.message);
        }
      } else {
        console.warn("Notice inserting locker assignment to Supabase:", aErr.message);
      }
    }
  } catch (err) {
    console.warn("Could not insert locker assignment to Supabase:", err);
  }

  // 3. Persist in localStorage
  saveLocalAssignments([assignment, ...currentAssignments]);
  saveLocalLockers(currentLockers.map(l => (l.id === locker.id ? updatedLocker : l)));

  return { success: true, assignment, updatedLocker };
}

/**
 * Releases/returns a locker: marks assignment as returned and sets locker to AVAILABLE.
 * Supports releaseLockerInDatabase({ lockerId, actor }) OR releaseLockerInDatabase(assignmentId, lockerId, actor) OR releaseLockerInDatabase(lockerId, actor).
 */
export async function releaseLockerInDatabase(
  firstArg: string | { lockerId: string; actor: string; assignmentId?: string },
  secondArg?: string,
  thirdArg?: string
): Promise<{
  success: boolean;
  updatedLocker: Locker;
  updatedAssignment: LockerAssignment | null;
  error?: string;
}> {
  let lockerId = "";
  let actor = "Staff";
  let targetAssignmentId = "";

  if (typeof firstArg === "object") {
    lockerId = firstArg.lockerId;
    actor = firstArg.actor || "Staff";
    targetAssignmentId = firstArg.assignmentId || "";
  } else if (thirdArg !== undefined) {
    // releaseLockerInDatabase(assignmentId, lockerId, actor)
    targetAssignmentId = firstArg;
    lockerId = secondArg || "";
    actor = thirdArg || "Staff";
  } else {
    // releaseLockerInDatabase(lockerId, actor)
    lockerId = firstArg;
    actor = secondArg || "Staff";
  }

  const currentLockers = getLocalLockers();
  const locker = currentLockers.find(l => l.id === lockerId);
  if (!locker) {
    return { success: false, updatedLocker: {} as Locker, updatedAssignment: null, error: "Locker not found" };
  }

  const currentAssignments = getLocalAssignments();
  const activeAssignmentIndex = currentAssignments.findIndex(a =>
    (targetAssignmentId && a.id === targetAssignmentId) || (a.lockerId === lockerId && a.status === "active")
  );

  const nowIso = new Date().toISOString();
  const updatedLocker: Locker = {
    ...locker,
    status: "AVAILABLE",
    updatedAt: nowIso,
  };

  let updatedAssignment: LockerAssignment | null = null;
  if (activeAssignmentIndex !== -1) {
    const currentA = currentAssignments[activeAssignmentIndex];
    updatedAssignment = {
      ...currentA,
      status: "returned",
      keyReturned: true,
      returnedAt: nowIso,
    };
    currentAssignments[activeAssignmentIndex] = updatedAssignment;
  }

  // 1. Update locker in Supabase
  try {
    await supabase
      .from("lockers")
      .update({
        status: "AVAILABLE",
        updated_at: nowIso,
      })
      .eq("id", lockerId);
  } catch (err) {
    console.warn("Could not update locker in Supabase:", err);
  }

  // 2. Update assignment in Supabase
  if (updatedAssignment) {
    try {
      await supabase
        .from("locker_assignments")
        .update({
          status: "returned",
          returned_at: nowIso,
        })
        .eq("id", updatedAssignment.id);
    } catch (err) {
      console.warn("Could not update assignment in Supabase:", err);
    }
  }

  // 3. Persist in localStorage
  saveLocalLockers(currentLockers.map(l => (l.id === locker.id ? updatedLocker : l)));
  saveLocalAssignments(currentAssignments);

  return { success: true, updatedLocker, updatedAssignment };
}

/**
 * Marks a locker as OUT_OF_SERVICE with lost key fee.
 * Supports reportLostKeyInDatabase({ lockerId, actor, fee }) OR reportLostKeyInDatabase(assignmentId, lockerId, actor, fee).
 */
export async function reportLostKeyInDatabase(
  firstArg: string | { lockerId: string; actor: string; fee: number; assignmentId?: string },
  secondArg?: string | number,
  thirdArg?: string | number,
  fourthArg?: number
): Promise<{
  success: boolean;
  updatedLocker: Locker;
  updatedAssignment: LockerAssignment | null;
  error?: string;
}> {
  let lockerId = "";
  let actor = "Staff";
  let fee = 0;
  let targetAssignmentId = "";

  if (typeof firstArg === "object") {
    lockerId = firstArg.lockerId;
    actor = firstArg.actor;
    fee = firstArg.fee;
    targetAssignmentId = firstArg.assignmentId || "";
  } else if (fourthArg !== undefined) {
    // reportLostKeyInDatabase(assignmentId, lockerId, actor, fee)
    targetAssignmentId = firstArg;
    lockerId = String(secondArg || "");
    actor = String(thirdArg || "Staff");
    fee = fourthArg;
  } else {
    // reportLostKeyInDatabase(lockerId, actor, fee)
    lockerId = firstArg;
    actor = String(secondArg || "Staff");
    fee = Number(thirdArg) || 0;
  }

  const currentLockers = getLocalLockers();
  const locker = currentLockers.find(l => l.id === lockerId);
  if (!locker) {
    return { success: false, updatedLocker: {} as Locker, updatedAssignment: null, error: "Locker not found" };
  }

  const currentAssignments = getLocalAssignments();
  const activeAssignmentIndex = currentAssignments.findIndex(a =>
    (targetAssignmentId && a.id === targetAssignmentId) || (a.lockerId === lockerId && a.status === "active")
  );

  const nowIso = new Date().toISOString();
  const updatedLocker: Locker = {
    ...locker,
    status: "OUT_OF_SERVICE",
    updatedAt: nowIso,
  };

  let updatedAssignment: LockerAssignment | null = null;
  if (activeAssignmentIndex !== -1) {
    const currentA = currentAssignments[activeAssignmentIndex];
    updatedAssignment = {
      ...currentA,
      status: "lost",
      lostKeyFee: fee,
      returnedAt: nowIso,
    };
    currentAssignments[activeAssignmentIndex] = updatedAssignment;
  }

  // 1. Update in Supabase
  try {
    await supabase.from("lockers").update({ status: "OUT_OF_SERVICE", updated_at: nowIso }).eq("id", lockerId);
    if (updatedAssignment) {
      await supabase.from("locker_assignments").update({ status: "lost" }).eq("id", updatedAssignment.id);
    }
  } catch (err) {
    console.warn("Notice updating lost key in Supabase:", err);
  }

  // 2. Persist in localStorage
  saveLocalLockers(currentLockers.map(l => (l.id === locker.id ? updatedLocker : l)));
  saveLocalAssignments(currentAssignments);

  return { success: true, updatedLocker, updatedAssignment };
}

/**
 * Filters assignments to show only those from the last 7 days.
 * Does NOT delete older records from the database or history.
 */
export function filterRecentAssignments(assignments: LockerAssignment[], days = 7): LockerAssignment[] {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return assignments
    .filter(a => {
      const time = new Date(a.assignedAt).getTime();
      return !isNaN(time) && time >= cutoffMs;
    })
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
}
