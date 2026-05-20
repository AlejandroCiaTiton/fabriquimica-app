import { useState } from 'react'
import { supabaseAdmin, crearAuthUser } from '../../lib/supabaseAdmin'
import { supabase } from '../../lib/supabase'

const PASS_DEFAULT = '123456'

// tipoDB: valor real en perfiles.tipo (enum DB)
// rolVendedor: si está definido, se inserta un registro en la tabla vendedores con ese rol
const TIPOS_USUARIO = [
  { value: 'admin',         tipoDB: 'admin',         label: 'Administrador',   desc: 'Acceso total: precios, stock, clientes, usuarios' },
  { value: 'vendedor',      tipoDB: 'vendedor',      label: 'Vendedor',        rolVendedor: 'vendedor', desc: 'Gestión de cotizaciones, órdenes y clientes domésticos' },
  { value: 'jefe_ventas',   tipoDB: 'vendedor',      label: 'Jefe de Ventas',  rolVendedor: 'jefe',     desc: 'Vendedor con acceso a delegaciones, asignación y plan de ventas' },
  { value: 'vendedor_expo', tipoDB: 'vendedor_expo', label: 'Vendedor EXPO',   rolVendedor: 'expo',     desc: 'Cotizaciones de exportación con dimensionamiento de carga' },
  { value: 'comex',         tipoDB: 'comex',         label: 'COMEX',           desc: 'Comercio exterior: cotiza fletes y costos internacionales' },
  { value: 'finanzas',      tipoDB: 'finanzas',      label: 'Finanzas',        desc: 'Facturación, estado de cuenta y gestión de pagos' },
  { value: 'logistica',     tipoDB: 'logistica',     label: 'Logística',       desc: 'Mapa de entregas, plan diario, recepción y cronograma de envíos' },
  { value: 'deposito',      tipoDB: 'deposito',      label: 'Depósito',        desc: 'Cronograma de envíos: confirma carga y reporta problemas' },
  { value: 'produccion',    tipoDB: 'produccion',    label: 'Producción',      desc: 'Registro de producción, órdenes y calendario' },
  { value: 'laboratorio',   tipoDB: 'laboratorio',   label: 'Laboratorio',     desc: 'COAs por lote, muestras, contratipos y desarrollos' },
  { value: 'chofer',           tipoDB: 'chofer',           label: 'Chofer',             desc: 'Vista calendarizada de entregas y confirmación en ruta' },
  { value: 'asistente_ventas', tipoDB: 'asistente_ventas', label: 'Asistente de ventas', desc: 'Visibilidad de todas las órdenes de compra, sin importar el vendedor asignado' },
]

export default function GestionUsuarios() {
  const [form, setForm]       = useState({ nombre: '', email: '', tipo: 'admin' })
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const [ok, setOk]           = useState('')

  const [resetEmail, setResetEmail]     = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetErr, setResetErr]         = useState('')
  const [resetOk, setResetOk]           = useState('')

  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]'

  async function crearUsuario(e) {
    e.preventDefault()
    if (!form.email.trim()) {
      setErr('El email es requerido')
      return
    }
    setLoading(true)
    setErr('')
    setOk('')
    try {
      const tipoConfig = TIPOS_USUARIO.find(t => t.value === form.tipo)

      // 1. Crear usuario en Auth con contraseña por defecto
      const user = await crearAuthUser(form.email.trim(), PASS_DEFAULT)

      // 2. Crear perfil usando tipoDB (jefe_ventas → 'vendedor' en la DB)
      const { error: perfErr } = await supabaseAdmin.from('perfiles').upsert({
        id:     user.id,
        nombre: form.nombre.trim() || form.email.trim(),
        tipo:   tipoConfig?.tipoDB ?? form.tipo,
      }, { onConflict: 'id' })
      if (perfErr) throw perfErr

      // 3. Crear registro en vendedores para los roles que lo requieren
      if (tipoConfig?.rolVendedor) {
        const { error: evErr } = await supabaseAdmin.from('vendedores').insert({
          perfil_id: user.id,
          rol: tipoConfig.rolVendedor,
        })
        if (evErr) throw evErr
      }

      // 3. Marcar cambio obligatorio de contraseña (requiere migration_expo.sql — falla silenciosamente si no existe la columna)
      await supabaseAdmin.from('perfiles')
        .update({ debe_cambiar_pass: true })
        .eq('id', user.id)

      // 3. Enviar email con link de configuración de contraseña
      const redirectTo = `${window.location.origin}/nueva-contrasena`
      await supabase.auth.resetPasswordForEmail(form.email.trim().toLowerCase(), { redirectTo })

      const tipoLabel = TIPOS_USUARIO.find(t => t.value === form.tipo)?.label ?? form.tipo
      setOk(`✓ ${tipoLabel} "${form.nombre || form.email}" creado. Se envió un correo a ${form.email} con el enlace para configurar su contraseña.`)
      setForm(f => ({ nombre: '', email: '', tipo: f.tipo }))
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function resetearAcceso(e) {
    e.preventDefault()
    if (!resetEmail.trim()) { setResetErr('El email es requerido'); return }
    setResetLoading(true)
    setResetErr('')
    setResetOk('')
    try {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listErr) throw listErr
      const target = list?.users?.find(u => u.email === resetEmail.trim().toLowerCase())
      if (!target) throw new Error(`No existe ningún usuario con el email "${resetEmail.trim()}"`)

      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(target.id, { password: PASS_DEFAULT })
      if (updErr) throw updErr

      await supabaseAdmin.from('perfiles').update({ debe_cambiar_pass: true }).eq('id', target.id)

      setResetOk(`✓ Contraseña reseteada a "${PASS_DEFAULT}". El usuario puede ingresar con esa contraseña y luego cambiarla.`)
      setResetEmail('')
    } catch (e) {
      setResetErr(e.message)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-400 mt-0.5">Creación de usuarios internos</p>
      </div>

      <div className="bg-white rounded-[10px] shadow-card p-6">
        <h2 className="font-semibold text-gray-800 mb-1">Nuevo usuario</h2>
        <p className="text-xs text-gray-400 mb-5">
          El acceso inicial se genera con contraseña <span className="font-mono font-semibold text-gray-600">{PASS_DEFAULT}</span>.
          El usuario recibirá un correo para configurarla antes de su primer ingreso.
        </p>

        <form onSubmit={crearUsuario} className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de usuario</label>
            <div className="flex flex-col gap-2">
              {TIPOS_USUARIO.map(t => (
                <label key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.tipo === t.value ? 'border-[#004a99] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="tipo" value={t.value} checked={form.tipo === t.value}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="mt-0.5 accent-[#004a99]"/>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input className={INPUT} value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: María García" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input className={INPUT} type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="usuario@fabriquimica.com" required />
          </div>

          {err && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
          )}
          {ok && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{ok}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Crear usuario y enviar acceso
          </button>
        </form>
      </div>

      {/* Resetear acceso */}
      <div className="bg-white rounded-[10px] shadow-card p-6 mt-5">
        <h2 className="font-semibold text-gray-800 mb-1">Resetear acceso</h2>
        <p className="text-xs text-gray-400 mb-4">
          Resetea la contraseña de un usuario existente a <span className="font-mono font-semibold text-gray-600">{PASS_DEFAULT}</span>.
          Útil cuando el usuario no puede ingresar o perdió sus credenciales.
        </p>
        <form onSubmit={resetearAcceso} className="space-y-3">
          <input className={INPUT} type="email" value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            placeholder="email@fabriquimica.com" required />
          {resetErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetErr}</p>}
          {resetOk  && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{resetOk}</p>}
          <button type="submit" disabled={resetLoading}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
            {resetLoading && <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>}
            Resetear contraseña
          </button>
        </form>
      </div>
    </div>
  )
}
