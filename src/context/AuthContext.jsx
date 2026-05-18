import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]           = useState(undefined) // undefined = cargando sesión
  const [perfil, setPerfil]             = useState(null)
  const [perfilLoading, setPerfilLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) cargarPerfil(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) cargarPerfil(session.user.id)
      else { setPerfil(null); setPerfilLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cargarPerfil(userId) {
    setPerfilLoading(true)
    const { data, error } = await supabase
      .from('perfiles')
      .select('*, vendedores(*)')
      .eq('id', userId)
      .single()

    if (!error && data) setPerfil(data)
    else if (error) console.error('[auth] cargarPerfil:', error.message)
    setPerfilLoading(false)
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    queryClient.clear()
  }

  const isLoading = session === undefined || perfilLoading
  const isAuthenticated = !!session

  // Supabase may return vendedores as array or single object depending on PostgREST version
  const vendedorRecord  = Array.isArray(perfil?.vendedores) ? perfil.vendedores[0] : perfil?.vendedores

  // Helpers de rol
  const isAdmin         = perfil?.tipo === 'admin'
  const isVendedor      = perfil?.tipo === 'vendedor'
  const isJefeVentas    = perfil?.tipo === 'vendedor' && vendedorRecord?.rol === 'jefe'
  const isCliente       = perfil?.tipo === 'cliente'
  const isLogistica     = perfil?.tipo === 'logistica'
  const isProduccion    = perfil?.tipo === 'produccion'
  const isFinanzas      = perfil?.tipo === 'finanzas'
  const isChofer        = perfil?.tipo === 'chofer'
  const isVendedorExpo  = perfil?.tipo === 'vendedor_expo'
  const isComex         = perfil?.tipo === 'comex'
  const isDeposito      = perfil?.tipo === 'deposito'
  const isLaboratorio   = perfil?.tipo === 'laboratorio'

  return (
    <AuthContext.Provider value={{
      session,
      perfil,
      isLoading,
      isAuthenticated,
      isAdmin,
      isVendedor,
      isJefeVentas,
      isCliente,
      isLogistica,
      isProduccion,
      isFinanzas,
      isChofer,
      isVendedorExpo,
      isComex,
      isDeposito,
      isLaboratorio,
      perfilLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
