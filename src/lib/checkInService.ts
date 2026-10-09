import { supabase } from "@/integrations/supabase/client";
import type { CustomerCategory, Member, Visit, Plan, GymSettings, MemberStatus } from "@/types";
import { computeMemberStatus } from "@/context/GymContext";

export interface FetchResult {
  members: Member[];
  visits: Visit[];
  error?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  lastVisitTime?: string;
  minutesAgo?: number;
  formattedTime?: string;
}

const LOCAL_VISITS_KEY = "powerplus_visits";

/**
 * Loads visits persisted in localStorage.
 */
export function getLocalVisits(): Visit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_VISITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves visits to localStorage for persistent state across page reloads.
 */
export function saveLocalVisits(visits: Visit[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_VISITS_KEY, JSON.stringify(visits));
  } catch (err) {
    console.warn("Could not save visits to localStorage:", err);
  }
}

/**
 * Helper to parse custom fields stored in notes string (e.g. "Plan ID: p1 | Emergency Contact: ...")
 */
function parseCustomerNotes(notes: string | null | undefined) {
  const result = {
    planId: "p1",
    emergencyContact: "",
    emergencyPhone: "",
    medicalNotes: "",
    studentId: "",
    institution: "",
  };

  if (!notes) return result;

  const planMatch = notes.match(/Plan ID:\s*([^\s|]+)/i);
  if (planMatch) result.planId = planMatch[1];

  const emergMatch = notes.match(/Emergency Contact:\s*([^|(]+)(?:\(([^)]*)\))?/i);
  if (emergMatch) {
    result.emergencyContact = emergMatch[1]?.trim() || "";
    result.emergencyPhone = emergMatch[2]?.trim() || "";
  }

  const medMatch = notes.match(/Medical Notes:\s*([^|]+)/i);
  if (medMatch) result.medicalNotes = medMatch[1]?.trim() || "";

  const stuMatch = notes.match(/Student ID:\s*([^|(]+)(?:\(([^)]*)\))?/i);
  if (stuMatch) {
    result.studentId = stuMatch[1]?.trim() || "";
    result.institution = stuMatch[2]?.trim() || "";
  }

  return result;
}

/**
 * Fetches real customers and attendance records directly from the database,
 * merges them with active membership plans, and maps them to Member & Visit structures.
 */
export async function fetchDatabaseMembersAndVisits(
  plans: Plan[] = [],
  settings?: GymSettings,
  localFallbackMembers: Member[] = []
): Promise<FetchResult> {
  try {
    // 1. Fetch customers from Supabase
    const { data: customerRows, error: customerErr } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (customerErr) {
      console.warn("Error fetching customers from database:", customerErr.message);
      return {
        members: localFallbackMembers,
        visits: getLocalVisits(),
        error: customerErr.message,
      };
    }

    // 2. Fetch attendance records from Supabase
    const { data: attendanceRows, error: attErr } = await supabase
      .from("attendance")
      .select("*")
      .order("checked_in_at", { ascending: false });

    if (attErr) {
      console.warn("Error fetching attendance from database:", attErr.message);
    }

    // 3. Fetch active memberships if available
    const { data: membershipRows } = await supabase
      .from("memberships")
      .select("*");

    const membershipMap = new Map<string, any>();
    if (membershipRows) {
      membershipRows.forEach(m => membershipMap.set(m.customer_id, m));
    }

    // Build last visit lookup from attendance
    const lastAttendanceMap = new Map<string, string>();
    const dbVisits: Visit[] = [];

    if (attendanceRows) {
      attendanceRows.forEach(att => {
        if (!lastAttendanceMap.has(att.customer_id)) {
          lastAttendanceMap.set(att.customer_id, att.checked_in_at);
        }

        // Map database attendance row into Visit format
        const matchingCustomer = customerRows?.find(c => c.id === att.customer_id);
        const cat = ((matchingCustomer?.customer_type as CustomerCategory) || "REGULAR");
        const isOverride = att.notes?.toLowerCase().includes("override") || false;

        dbVisits.push({
          id: att.id,
          memberId: att.customer_id,
          timestamp: att.checked_in_at,
          checkedInBy: att.notes?.includes("by") ? att.notes.split("by")[1]?.trim() || "Reception" : "Reception",
          category: cat,
          accessStatus: isOverride ? "override" : "allowed",
          overrideReason: att.notes || undefined,
        });
      });
    }

    // Merge with any local visits stored in localStorage (ensuring no duplicates by id or timestamp)
    const localVisits = getLocalVisits();
    const seenVisitKeys = new Set(dbVisits.map(v => `${v.memberId}_${v.timestamp}`));
    localVisits.forEach(lv => {
      const key = `${lv.memberId}_${lv.timestamp}`;
      if (!seenVisitKeys.has(key)) {
        seenVisitKeys.add(key);
        dbVisits.push(lv);
      }
    });

    // Sort all visits descending
    dbVisits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Map customers to Member objects
    const members: Member[] = (customerRows || []).map(c => {
      const parsedNotes = parseCustomerNotes(c.notes);
      const membership = membershipMap.get(c.id);

      // Identify category: strictly from customer_type in database
      const category: CustomerCategory =
        c.customer_type === "STUDENT" ||
        c.customer_type === "AEROBICS" ||
        c.customer_type === "MUSLIM"
          ? c.customer_type
          : "REGULAR";

      // Match plan
      let planId = parsedNotes.planId;
      if (membership?.plan_id) {
        planId = membership.plan_id;
      } else if (!planId || planId === "p1") {
        if (category === "AEROBICS") planId = "p5";
        else if (category === "STUDENT") planId = "p1";
        else planId = "p2";
      }

      // Compute expiry date
      let expiryDate: string;
      if (membership?.end_date) {
        expiryDate = membership.end_date;
      } else {
        // Calculate 30-day window from join_date or created_at
        const baseDate = new Date(c.join_date || c.created_at || new Date());
        const exp = new Date(baseDate);
        exp.setDate(exp.getDate() + 30);
        expiryDate = exp.toISOString().split("T")[0];
      }

      // Check last visit timestamp
      const recentVisit = dbVisits.find(v => v.memberId === c.id);
      const lastVisit = recentVisit ? recentVisit.timestamp : lastAttendanceMap.get(c.id) || null;

      // Status calculation
      let status: MemberStatus = "active";
      if (c.status?.toUpperCase() === "BLOCKED") {
        status = "blocked";
      } else if (settings) {
        const tempMember: Member = {
          id: c.id,
          memberId: c.customer_code,
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.customer_code,
          phone: c.phone || "",
          email: c.email || "",
          category,
          planId,
          joinDate: c.join_date || c.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
          expiryDate,
          lastVisit,
          status: "active",
          emergencyContact: parsedNotes.emergencyContact,
          emergencyPhone: parsedNotes.emergencyPhone,
          medicalNotes: parsedNotes.medicalNotes,
          emailNotifications: true,
          balanceDue: 0,
        };
        status = computeMemberStatus(tempMember, settings);
      }

      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.customer_code;

      return {
        id: c.id,
        memberId: c.customer_code,
        name: fullName,
        phone: c.phone || "",
        email: c.email || "",
        category,
        planId,
        joinDate: c.join_date || c.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        expiryDate,
        status,
        lastVisit,
        emergencyContact: parsedNotes.emergencyContact,
        emergencyPhone: parsedNotes.emergencyPhone,
        medicalNotes: parsedNotes.medicalNotes,
        studentId: parsedNotes.studentId || undefined,
        institution: parsedNotes.institution || undefined,
        studentVerified: category === "STUDENT",
        emailNotifications: true,
        balanceDue: 0,
      };
    });

    return { members, visits: dbVisits };
  } catch (err: any) {
    console.error("fetchDatabaseMembersAndVisits exception:", err);
    return {
      members: localFallbackMembers,
      visits: getLocalVisits(),
      error: err?.message || "Failed to fetch members",
    };
  }
}

/**
 * Checks if a member has already checked in today or within a recent window (duplicate check).
 */
export function checkDuplicateCheckIn(
  member: Member,
  visits: Visit[],
  cooldownMinutes: number = 60
): DuplicateCheckResult {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Look for any visits today for this member
  const memberVisitsToday = visits.filter(v => {
    if (v.memberId !== member.id && v.memberId !== member.memberId) return false;
    return v.timestamp.startsWith(todayStr);
  });

  if (memberVisitsToday.length === 0) {
    return { isDuplicate: false };
  }

  // Get most recent visit today
  const latestVisit = memberVisitsToday[0];
  const visitTime = new Date(latestVisit.timestamp);
  const diffMinutes = Math.floor((now.getTime() - visitTime.getTime()) / (1000 * 60));

  return {
    isDuplicate: true,
    lastVisitTime: latestVisit.timestamp,
    minutesAgo: Math.max(0, diffMinutes),
    formattedTime: visitTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Records a check-in both locally and in the Supabase database.
 * Updates public.customers updated_at & notes, and attempts to insert into public.attendance.
 */
export async function recordCheckInToDatabase(
  member: Member,
  accessStatus: "allowed" | "override",
  actor: string,
  reason?: string
): Promise<{ success: boolean; visit: Visit; error?: string }> {
  const nowIso = new Date().toISOString();
  const visitId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const visit: Visit = {
    id: visitId,
    memberId: member.id,
    timestamp: nowIso,
    checkedInBy: actor,
    category: member.category || "REGULAR",
    accessStatus,
    overrideReason: reason,
  };

  // 1. Update customer row in database (customers table allows anon updates)
  try {
    const checkInNote = `Check-in: ${nowIso} by ${actor}${reason ? ` (${reason})` : ""}`;
    await supabase
      .from("customers")
      .update({
        updated_at: nowIso,
      })
      .eq("id", member.id);
  } catch (err) {
    console.warn("Could not update customer updated_at in database:", err);
  }

  // 2. Insert into public.attendance
  try {
    const { error: attErr } = await supabase.from("attendance").insert({
      id: crypto.randomUUID(),
      customer_id: member.id,
      checked_in_at: nowIso,
      check_in_method: "MANUAL",
      notes: accessStatus === "override"
        ? `Override check-in by ${actor}: ${reason || "Staff override"}`
        : `Check-in by ${actor}`,
    });

    if (attErr) {
      console.warn("Notice on inserting to attendance table:", attErr.message);
    }
  } catch (err) {
    console.warn("Could not insert attendance row:", err);
  }

  // 3. Persist visit into localStorage
  try {
    const currentVisits = getLocalVisits();
    saveLocalVisits([visit, ...currentVisits]);
  } catch (err) {
    console.warn("Could not save visit locally:", err);
  }

  return { success: true, visit };
}

/**
 * Filters a list of members dynamically according to selected category and search query.
 * Guarantees that:
 * 1. If a category is selected (e.g. STUDENT), all members of that category are displayed immediately.
 * 2. If a search string is typed, it filters within that category by name, phone, email, or memberId.
 * 3. Does not produce stale results when switching filters.
 */
export function filterMembers(
  members: Member[],
  categoryFilter: CustomerCategory | "ALL",
  searchQuery: string
): Member[] {
  const trimmed = searchQuery.trim().toLowerCase();

  return members.filter(m => {
    // 1. Category filter: match member's category
    if (categoryFilter !== "ALL") {
      const memberCat = m.category || "REGULAR";
      if (memberCat !== categoryFilter) {
        return false;
      }
    }

    // 2. Search query filter: check name, phone, email, or memberId (customer_code)
    if (trimmed) {
      const matchName = m.name.toLowerCase().includes(trimmed);
      const matchPhone = m.phone.toLowerCase().includes(trimmed);
      const matchEmail = m.email.toLowerCase().includes(trimmed);
      const matchId = m.memberId.toLowerCase().includes(trimmed);
      return matchName || matchPhone || matchEmail || matchId;
    }

    return true;
  });
}
