import { supabase } from "../integrations/supabase/client";
import type { Locker, LockerAssignment, LockerSection, LockerStatus } from "../types";

export interface LockerData {
  lockers: Locker[];
  assignments: LockerAssignment[];
  customers: { id: string; name: string; customerCode: string }[];
}

interface LockerRow { id: string; locker_number: string; location: string; key_number: string | null; status: string; notes: string | null; created_at: string; }
interface AssignmentRow { id: string; locker_id: string; customer_id: string; assigned_at: string; returned_at: string | null; status: string; assigned_by: string | null; notes: string | null; }

const toLocker = (row: LockerRow): Locker => ({ id: row.id, number: row.locker_number, section: row.location as LockerSection, keyTag: row.key_number ?? "", status: row.status as LockerStatus, notes: row.notes ?? "", createdAt: row.created_at });

export async function fetchLockerData(): Promise<LockerData> {
  const [lockersResult, assignmentsResult, customersResult] = await Promise.all([
    supabase.from("lockers").select("id, locker_number, location, key_number, status, notes, created_at").order("locker_number"),
    supabase.from("locker_assignments").select("id, locker_id, customer_id, assigned_at, returned_at, status, assigned_by, notes").order("assigned_at", { ascending: false }),
    supabase.from("customers").select("id, first_name, last_name, customer_code").order("last_name"),
  ]);
  const error = lockersResult.error ?? assignmentsResult.error ?? customersResult.error;
  if (error) throw new Error(`Unable to load lockers: ${error.message}`);
  const customers = (customersResult.data ?? []).map(row => ({ id: row.id, name: `${row.first_name} ${row.last_name}`.trim(), customerCode: row.customer_code }));
  const customerNames = new Map(customers.map(customer => [customer.id, customer.name]));
  const assignments = (assignmentsResult.data ?? []).map(row => { const assignment = row as AssignmentRow; return { id: assignment.id, lockerId: assignment.locker_id, memberId: assignment.customer_id, memberName: customerNames.get(assignment.customer_id) ?? "Unknown", assignedAt: assignment.assigned_at, dueDate: null, returnedAt: assignment.returned_at, status: assignment.status as LockerAssignment["status"], keyReturned: assignment.status === "returned", lostKeyFee: 0, issuedBy: assignment.assigned_by ?? "", notes: assignment.notes ?? "" }; });
  return {
    lockers: (lockersResult.data ?? []).map(row => toLocker(row as LockerRow)),
    assignments,
    customers,
  };
}

export async function createLocker(input: { number: string; section: LockerSection; keyTag: string }) {
  const result = await supabase.from("lockers").insert([{ locker_number: input.number, location: input.section, key_number: input.keyTag, status: "AVAILABLE" }] as never);
  if (result.error) throw new Error(`Unable to create locker: ${result.error.message}`);
}

export async function createLockers(items: { number: string; section: LockerSection; keyTag: string }[]) {
  const result = await supabase.from("lockers").insert(items.map(item => ({ locker_number: item.number, location: item.section, key_number: item.keyTag, status: "AVAILABLE" })) as never);
  if (result.error) throw new Error(`Unable to create lockers: ${result.error.message}`);
}

export async function updateLockerStatus(id: string, status: LockerStatus, notes?: string) {
  const result = await supabase.from("lockers").update({ status, ...(notes === undefined ? {} : { notes }) } as never).eq("id", id);
  if (result.error) throw new Error(`Unable to update locker: ${result.error.message}`);
}

export async function assignLocker(input: { lockerId: string; customerId: string; customerName: string; dueDate: string | null; notes: string; issuedBy: string }) {
  const result = await supabase.from("locker_assignments").insert([{
    locker_id: input.lockerId, customer_id: input.customerId, assigned_at: new Date().toISOString(),
    status: "active", assigned_by: input.issuedBy, notes: input.notes,
  }] as never);
  if (result.error) throw new Error(`Unable to assign locker: ${result.error.message}`);
  await updateLockerStatus(input.lockerId, "IN_USE");
}

export async function returnLockerAssignment(assignment: LockerAssignment) {
  const result = await supabase.from("locker_assignments").update({ status: "returned", returned_at: new Date().toISOString() } as never).eq("id", assignment.id);
  if (result.error) throw new Error(`Unable to return locker: ${result.error.message}`);
  await updateLockerStatus(assignment.lockerId, "AVAILABLE");
}

export async function loseLockerKey(assignment: LockerAssignment, fee: number, notes: string) {
  const result = await supabase.from("locker_assignments").update({ status: "lost", returned_at: new Date().toISOString(), notes: `${notes} · Lost key fee: ${fee}` } as never).eq("id", assignment.id);
  if (result.error) throw new Error(`Unable to record lost key: ${result.error.message}`);
  await updateLockerStatus(assignment.lockerId, "OUT_OF_SERVICE", notes);
}
