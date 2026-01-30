import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 데모 모드 감지
export const isDemoMode = !supabaseUrl || !supabaseAnonKey

// Supabase 클라이언트 (데모 모드에서는 더미 클라이언트)
export const supabase: SupabaseClient = isDemoMode
  ? createClient('https://demo.supabase.co', 'demo-key')
  : createClient(supabaseUrl, supabaseAnonKey)

export type MindMapData = {
  id: string
  user_id: string
  title: string
  data: object
  created_at: string
  updated_at: string
  is_shared: boolean
  shared_with: string[]
}

export type UserProfile = {
  id: string
  email: string
  role: 'admin' | 'user'
  license_key?: string
  license_expires_at?: string
  created_at: string
}
