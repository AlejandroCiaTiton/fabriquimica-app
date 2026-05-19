import { useState } from 'react'
import { useClientePerfil, useActualizarPerfilCliente, useSubirDocumentoCliente } from '../../hooks/useClientePerfil'

function DocCard({ label, url, tipo, onUpload, uploading }) {
  const colores = {
    afip:            { bg: 'bg-blue-50',   border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'  },
    ingresos_brutos: { bg: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    cm05:            { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  }
  const c = colores[tipo]

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {url
            ? <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${c.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
                Cargado
              </span>
            : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 bg-gray-100 text-gray-500">
                Pendiente
              </span>
          }
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 text-xs font-medium text-[#004a99] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            Ver
          </a>
        )}
      </div>
      <label className={`flex items-center gap-2 cursor-pointer w-fit text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
        uploading
          ? 'border-gray-200 text-gray-400 bg-white'
          : 'border-gray-300 text-gray-600 hover:border-[#004a99] hover:text-[#004a99] bg-white'
      }`}>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          disabled={uploading}
          onChange={e => { const f = e.target.files[0]; if (f) onUpload(tipo, f); e.target.value = '' }}
        />
        {uploading
          ? <><div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> Subiendo…</>
          : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            {url ? 'Reemplazar' : 'Subir PDF'}</>
        }
      </label>
    </div>
  )
}

function Campo({ label, value, onChange, placeholder, type = 'text', multiline = false }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"/>
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
      }
    </div>
  )
}

export default function PerfilEmpresa() {
  const { data: perfil, isLoading } = useClientePerfil()
  const actualizar = useActualizarPerfilCliente()
  const subirDoc   = useSubirDocumentoCliente()

  const [editando, setEditando]   = useState(false)
  const [guardado, setGuardado]   = useState(false)
  const [uploadingTipo, setUploadingTipo] = useState(null)

  const [form, setForm] = useState({
    sitio_web:              '',
    horario_entrega:        '',
    descripcion_produccion: '',
    telefonos_recepcion:    '',
    direccion_entrega:      '',
  })

  function campo(key) {
    return editando ? (form[key] ?? '') : (perfil?.[key] ?? '')
  }

  function iniciarEdicion() {
    setForm({
      sitio_web:              perfil?.sitio_web              ?? '',
      horario_entrega:        perfil?.horario_entrega        ?? '',
      descripcion_produccion: perfil?.descripcion_produccion ?? '',
      telefonos_recepcion:    perfil?.telefonos_recepcion    ?? '',
      direccion_entrega:      perfil?.direccion_entrega      ?? '',
    })
    setEditando(true)
    setGuardado(false)
  }

  async function guardar() {
    await actualizar.mutateAsync(form)
    setEditando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 3000)
  }

  async function handleUpload(tipo, file) {
    setUploadingTipo(tipo)
    try {
      await subirDoc.mutateAsync({ tipo, file })
    } finally {
      setUploadingTipo(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  const docsCompletos = !!(perfil?.afip_url && perfil?.ingresos_brutos_url)
  const infoCompleta  = !!(perfil?.horario_entrega && perfil?.telefonos_recepcion)

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mi Empresa</h1>
        <p className="text-sm text-gray-400 mt-0.5">{perfil?.razon_social}</p>
      </div>

      {/* Estado del perfil */}
      {(!docsCompletos || !infoCompleta) && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Perfil incompleto</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Completá los documentos y la información de tu empresa para facilitar la gestión de pedidos.
            </p>
          </div>
        </div>
      )}

      {/* Documentos */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Documentos impositivos</h2>
          {docsCompletos && (
            <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completos</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DocCard
            label="Alta en AFIP"
            url={perfil?.afip_url}
            tipo="afip"
            onUpload={handleUpload}
            uploading={uploadingTipo === 'afip'}
          />
          <DocCard
            label="Ingresos Brutos"
            url={perfil?.ingresos_brutos_url}
            tipo="ingresos_brutos"
            onUpload={handleUpload}
            uploading={uploadingTipo === 'ingresos_brutos'}
          />
          <DocCard
            label="CM05 (si aplica)"
            url={perfil?.cm05_url}
            tipo="cm05"
            onUpload={handleUpload}
            uploading={uploadingTipo === 'cm05'}
          />
        </div>
      </section>

      {/* Información de la empresa */}
      <section className="bg-white rounded-[10px] shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Información de la empresa</h2>
          {!editando && (
            <button onClick={iniciarEdicion}
              className="text-xs font-medium text-[#004a99] hover:underline flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Editar
            </button>
          )}
        </div>

        <div className="space-y-4">
          {editando ? (
            <>
              <Campo label="Sitio web" value={form.sitio_web} onChange={v => setForm(f => ({...f, sitio_web: v}))} placeholder="https://www.miempresa.com"/>
              <Campo label="Dirección de entrega" value={form.direccion_entrega} onChange={v => setForm(f => ({...f, direccion_entrega: v}))} placeholder="Av. Ejemplo 1234, Buenos Aires"/>
              <Campo label="Horario de entrega" value={form.horario_entrega} onChange={v => setForm(f => ({...f, horario_entrega: v}))} placeholder="Lun-Vie 8-17hs"/>
              <Campo label="Teléfonos para recepción de pedidos" value={form.telefonos_recepcion} onChange={v => setForm(f => ({...f, telefonos_recepcion: v}))} placeholder="011-4567-8901 / 011-4567-8902"/>
              <Campo label="Descripción de producción" value={form.descripcion_produccion} onChange={v => setForm(f => ({...f, descripcion_produccion: v}))} placeholder="Describí brevemente a qué se dedica tu empresa…" multiline/>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditando(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={guardar} disabled={actualizar.isPending}
                  className="flex-1 bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {actualizar.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  Guardar cambios
                </button>
              </div>

              {actualizar.isError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {actualizar.error?.message}
                </p>
              )}
            </>
          ) : (
            <>
              {guardado && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm mb-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Cambios guardados
                </div>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  ['Sitio web',                    perfil?.sitio_web,              'https://…'],
                  ['Dirección de entrega',          perfil?.direccion_entrega,      'Sin informar'],
                  ['Horario de entrega',            perfil?.horario_entrega,        'Sin informar'],
                  ['Teléfonos para pedidos',        perfil?.telefonos_recepcion,    'Sin informar'],
                ].map(([label, val, placeholder]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-gray-500 mb-0.5">{label}</dt>
                    <dd className={val ? 'text-gray-900' : 'text-gray-300 italic'}>{val || placeholder}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-gray-500 mb-0.5">Descripción de producción</dt>
                  <dd className={perfil?.descripcion_produccion ? 'text-gray-900' : 'text-gray-300 italic'}>
                    {perfil?.descripcion_produccion || 'Sin informar'}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
