// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// RN/Expo 환경에서 fetch/polyfill은 Expo가 제공함
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // 우리 앱 JWT(백엔드) 별도라면 false
});
