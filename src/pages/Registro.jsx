import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CAMPO = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332] focus:border-transparent'

function Input({ label, required, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-[#dc3545]">*</span>}
      </label>
      <input className={CAMPO} {...props} />
    </div>
  )
}

export default function Registro() {
  const [form, setForm] = useState({
    razon_social: '', cuit: '', pais: 'Argentina', direccion: '',
    c_nombre: '', c_email: '', c_tel: '',
    a_nombre: '', a_email: '', a_tel: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    const esArgentina = form.pais.trim().toLowerCase() === 'argentina' || !form.pais.trim()
    if (!form.razon_social.trim() || (esArgentina && !form.cuit.trim()) || !form.c_nombre.trim() || !form.c_email.trim()) {
      setError('Completá los campos obligatorios marcados con *')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.from('solicitudes_alta').insert({
        razon_social:             form.razon_social.trim(),
        cuit:                     form.cuit.trim() || null,
        pais:                     form.pais.trim() || null,
        direccion:                form.direccion.trim() || null,
        contacto_compras_nombre:  form.c_nombre.trim(),
        contacto_compras_email:   form.c_email.trim().toLowerCase(),
        contacto_compras_tel:     form.c_tel.trim() || null,
        contacto_admin_nombre:    form.a_nombre.trim() || null,
        contacto_admin_email:     form.a_email.trim().toLowerCase() || null,
        contacto_admin_tel:       form.a_tel.trim() || null,
      })
      if (err) throw err
      setExito(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
        <div className="bg-white rounded-[10px] shadow-md w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Solicitud enviada!</h2>
          <p className="text-gray-500 text-sm mb-1">Recibimos tu solicitud de alta.</p>
          <p className="text-gray-500 text-sm mb-6">Administración revisará los datos y te contactará a la brevedad.</p>
          <Link to="/login" className="text-[#1b4332] text-sm font-medium hover:underline">← Volver al inicio de sesión</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1b4332]">Fabriquímica</h1>
            <p className="text-sm text-gray-500 mt-0.5">Registro de nuevo cliente</p>
          </div>
          <Link to="/login" className="text-sm text-gray-500 hover:text-[#1b4332] flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </Link>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Columna izquierda */}
            <div className="space-y-5">

              {/* Datos empresa */}
              <div className="bg-white rounded-[10px] shadow-sm p-6 space-y-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1b4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                  Datos de la empresa
                </h2>
                <Input label="Razón social" required placeholder="Ej: Laboratorios XYZ S.A." value={form.razon_social} onChange={set('razon_social')} />
                <Input label="CUIT" required={!form.pais.trim() || form.pais.trim().toLowerCase() === 'argentina'} placeholder="30-12345678-9" value={form.cuit} onChange={set('cuit')} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input className={CAMPO} list="paises-registro" value={form.pais} onChange={set('pais')} placeholder="Argentina" />
                  <datalist id="paises-registro">
                    {['Argentina','Brasil','Uruguay','Chile','Paraguay','Bolivia','Perú','Colombia',
                      'Venezuela','Ecuador','México','España','Estados Unidos'].map(p => <option key={p} value={p}/>)}
                  </datalist>
                </div>
                <Input label="Dirección" placeholder="Av. Corrientes 1234, CABA" value={form.direccion} onChange={set('direccion')} />
              </div>

              {/* Contacto compras */}
              <div className="bg-white rounded-[10px] shadow-sm p-6 space-y-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1b4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                  </svg>
                  Contacto de compras
                </h2>
                <Input label="Nombre y apellido" required placeholder="Ej: Ana Rodríguez" value={form.c_nombre} onChange={set('c_nombre')} />
                <Input label="Email" required type="email" placeholder="compras@empresa.com" value={form.c_email} onChange={set('c_email')} />
                <Input label="Teléfono" placeholder="011-4521-0001" value={form.c_tel} onChange={set('c_tel')} />
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-5">

              {/* Contacto administración */}
              <div className="bg-white rounded-[10px] shadow-sm p-6 space-y-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1b4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Contacto de administración
                  <span className="text-xs font-normal text-gray-400">(pago a proveedores)</span>
                </h2>
                <Input label="Nombre y apellido" placeholder="Ej: Carlos Méndez" value={form.a_nombre} onChange={set('a_nombre')} />
                <Input label="Email" type="email" placeholder="pagos@empresa.com" value={form.a_email} onChange={set('a_email')} />
                <Input label="Teléfono" placeholder="011-4521-0002" value={form.a_tel} onChange={set('a_tel')} />
              </div>

              {/* ¿Qué pasa después? */}
              <div className="bg-white rounded-[10px] shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">¿Qué pasa después?</h2>
                <div className="space-y-3">
                  {[
                    ['Tu solicitud llega a Administración', 'Revisarán los datos ingresados'],
                    ['Se define condición de pago y vendedor', 'Administración asignará tu cuenta'],
                    ['Recibís acceso al sistema', 'Podrás comenzar a solicitar cotizaciones'],
                  ].map(([titulo, desc], i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-[#f0f4f8] rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-[#1b4332] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{titulo}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="mt-4 text-sm text-[#dc3545] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading}
                  className="mt-5 w-full bg-[#1b4332] hover:bg-[#152e24] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Enviando...</>
                    : <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                        Enviar solicitud de alta
                      </>
                  }
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
