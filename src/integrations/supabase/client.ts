import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://pmoedmgsikhhlehmxmoa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtb2VkbWdzaWtoaGxlaG14bW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzA2MDEsImV4cCI6MjEwNjEwNjYwMX0.uXtXU-NGHxI27bwNzFxtON3Q6rc4jW1w2Xn_vidhHfs";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
