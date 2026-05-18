import { createClient } from '@supabase/supabase-js'

const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = serviceKey
  ? createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

export async function crearAuthUser(email, password) {
  if (!supabaseAdmin) {
    throw new Error(
      'Falta la service role key. Agregá VITE_SUPABASE_SERVICE_ROLE_KEY en .env.local'
    )
  }
  const normalizedEmail = email.trim().toLowerCase()

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  })

  if (!error) return data.user

  // If the auth user already exists (failed previous attempt), fetch it and reset its password
  if (error.message?.toLowerCase().includes('already')) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users?.find(u => u.email === normalizedEmail)
    if (existing) {
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
      return existing
    }
  }

  throw error
}
