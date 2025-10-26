// src/supabase.js
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Clients ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE2MjM3OCwiZXhwIjoyMDc1NzM4Mzc4fQ.Wu8NyTeIU5rB_evLHfg2RSTqt9UKjEQEIF-RCfbOvQM";

// User client (browser)
export const supabase = createClient(supabaseUrl, anonKey);

// Admin client (service role)
export const adminSupabase = createClient(supabaseUrl, serviceKey);
