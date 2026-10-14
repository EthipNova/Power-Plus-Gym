import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL : (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : undefined);
const SUPABASE_ANON_KEY = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY ? import.meta.env.VITE_SUPABASE_ANON_KEY : (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_ANON_KEY : undefined);

if (!SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

