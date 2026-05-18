import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCrearClienteVendedor } from '../../hooks/useClientes'

const CONDICIONES = [
  'Contado', 'Pago anticipado', 'Contra entrega',
  '15 días', '30 días', '60 días', '90 días', '120 días',
  '30/60 días', '30/60/90 días',
]

const CAMPO = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function AltaEmpresaVendedor() {
  const navigate    = useNavigate()
  const { perfil }  = useAuth()
  const crear       = useCrearClienteVendedor()

  const [form, setForm] = useState({
    razonSocial:    '',
    cuit:           '',
    pais:           'Argentina',
    direccion:      '',
    condicionPago:  '',
    contactoNombre: '',
    contactoEmail:  '',
    contactoTel:    '',
  })
  const [error,  setError]  = useState('')
  const [creado, setCreado] = useState(null)

  const isExpo = perfil?.tipo === 'vendedor_expo'

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.razonSocial.trim()) return setError('La razón social es obligatoria.')
    try {
      const cliente = await crear.mutateAsync(form)
      setCreado(cliente)
    } catch (e) {
      setError(e.message)
    }
  }

  function handleNuevo() {
    setCreado(null)
    setForm({
      razonSocial: '', cuit: '', pais: 'Argentina', direccion: '',
      condicionPago: '', contactoNombre: '', contactoEmail: '', contactoTel: '',
    })
  }

  if (creado) {
    const esPendiente = creado.pendiente
    return (
      <div className="p-6 max-w-lg">
        <div className="bg-white rounded-[10px] shadow-card p-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${esPendiente ? 'bg-amber-100' : 'bg-green-100'}`}>
            <svg className={`w-7 h-7 ${esPendiente ? 'text-amber-600' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={esPendiente ? 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 'M5 13l4 4L19 7'}/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            {esPendiente ? 'Empresa registrada — pendiente de confirmación' : 'Empresa registrada'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {esPendiente
              ? <><strong>{creado.razon_social}</strong> fue registrada como cliente del exterior. El administrador debe confirmar el alta antes de que pueda cotizarse.</>
              : <><strong>{creado.razon_social}</strong> fue dada de alta y ya podés cotizarle.</>}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleNuevo}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Registrar otra
            </button>
            <button
              onClick={() => navigate(isExpo ? '/vendedor/expo-cotizaciones' : '/vendedor/cotizaciones')}
              className="px-4 py-2 text-sm font-semibold bg-[#004a99] text-white rounded-lg hover:bg-[#003d80]">
              Ir a cotizaciones
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Alta de empresa</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Registrá un cliente sin acceso al sistema — para cotizarle y generar OC directamente
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Datos empresa */}
        <div className="bg-white rounded-[10px] shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#004a99]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            Datos de la empresa
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Razón social" required>
                <input className={CAMPO} value={form.razonSocial} onChange={set('razonSocial')}
                  placeholder="Ej: Laboratorios XYZ S.A." />
              </Field>
            </div>

            <Field label="CUIT">
              <input className={CAMPO} value={form.cuit} onChange={set('cuit')}
                placeholder="30-12345678-9" />
            </Field>

            <Field label="País" required>
              <input className={CAMPO} list="paises-list" value={form.pais} onChange={set('pais')}
                placeholder="Argentina" />
              <datalist id="paises-list">
                {[
                  'Argentina','Brasil','Uruguay','Chile','Paraguay','Bolivia','Perú','Colombia',
                  'Venezuela','Ecuador','México','España','Estados Unidos','Alemania','Italia',
                  'Francia','China','India','Australia',
                ].map(p => <option key={p} value={p}/>)}
              </datalist>
            </Field>

            <div className="col-span-2">
              <Field label="Dirección">
                <input className={CAMPO} value={form.direccion} onChange={set('direccion')}
                  placeholder="Av. Corrientes 1234, CABA" />
              </Field>
            </div>

            <div className="col-span-2">
              <Field label="Condición de pago">
                <select className={CAMPO} value={form.condicionPago} onChange={set('condicionPago')}>
                  <option value="">Sin definir</option>
                  {CONDICIONES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white rounded-[10px] shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#004a99]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            Contacto de compras
            <span className="text-xs font-normal text-gray-400">(opcional)</span>
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Nombre y apellido">
                <input className={CAMPO} value={form.contactoNombre} onChange={set('contactoNombre')}
                  placeholder="Ej: Ana Rodríguez" />
              </Field>
            </div>
            <Field label="Email">
              <input className={CAMPO} type="email" value={form.contactoEmail} onChange={set('contactoEmail')}
                placeholder="compras@empresa.com" />
            </Field>
            <Field label="Teléfono">
              <input className={CAMPO} value={form.contactoTel} onChange={set('contactoTel')}
                placeholder="011-4521-0001" />
            </Field>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={crear.isPending}
            className="px-5 py-2 text-sm font-semibold bg-[#004a99] text-white rounded-lg hover:bg-[#003d80] disabled:opacity-50 flex items-center gap-2">
            {crear.isPending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Registrar empresa
          </button>
        </div>
      </form>
    </div>
  )
}
