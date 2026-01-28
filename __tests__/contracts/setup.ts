import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env file for contract tests
config();

// Contract tests use real Supabase - ensure env vars are set
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Contract tests require EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY env vars'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
