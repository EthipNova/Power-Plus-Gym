import { supabase } from "../integrations/supabase/client";

export interface ExpenseRecord {
  id: string;
  category: string;
  amount: number | string | null;
  expense_date: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ExpensePage {
  expenses: ExpenseRecord[];
  total: number;
  totalAmount: number;
}

const PAGE_SIZE = 25;
const EXPENSE_FIELDS = "id, category, amount, expense_date, note, recorded_by, created_at";

function cleanSearch(value: string) {
  return value.trim().replace(/[,%()]/g, " ");
}

export async function fetchExpenses({ search, category, page }: { search: string; category: string; page: number }): Promise<ExpensePage> {
  let query = supabase.from("expenses").select(EXPENSE_FIELDS, { count: "exact" }).order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  const normalizedSearch = cleanSearch(search);
  if (category !== "all") query = query.eq("category", category);
  if (normalizedSearch) query = query.or(`category.ilike.%${normalizedSearch}%,note.ilike.%${normalizedSearch}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Unable to load expenses: ${error.message}`);

  let totalQuery = supabase.from("expenses").select("amount");
  if (category !== "all") totalQuery = totalQuery.eq("category", category);
  if (normalizedSearch) totalQuery = totalQuery.or(`category.ilike.%${normalizedSearch}%,note.ilike.%${normalizedSearch}%`);
  const totalResult = await totalQuery;
  if (totalResult.error) throw new Error(`Unable to calculate expenses total: ${totalResult.error.message}`);

  const totalAmount = (totalResult.data ?? []).reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
  return { expenses: (data ?? []) as ExpenseRecord[], total: count ?? 0, totalAmount };
}

export async function createExpense(input: { category: string; amount: number; expenseDate: string; note: string; recordedBy: string }): Promise<void> {
  const result = await supabase.from("expenses").insert([{
    category: input.category,
    amount: input.amount,
    expense_date: input.expenseDate,
    note: input.note,
    recorded_by: input.recordedBy,
  }] as never);
  if (result.error) throw new Error(`Unable to save expense: ${result.error.message}`);
}

export { PAGE_SIZE as EXPENSE_PAGE_SIZE };
