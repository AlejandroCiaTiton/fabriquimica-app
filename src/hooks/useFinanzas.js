import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { emitirFacturaAFIP, formatearNumeroFactura, PUNTO_VENTA_DEFAULT } from '../lib/afip'

// supabaseAdmin bypasses RLS — finanzas necesita leer todas las OCs sin restricción por vendedor
const db = supabaseAdmin ?? supabase

const SELECT_OC = `
  id, numero, estado, estado_pago, numero_factura, fecha_vencimiento_factura, creado_en,
  cotizaciones(
    id, codigo, total,
    clientes(id, razon_social, cuit),
    cotizacion_items(id, cantidad, lote_aplicado, productos(nombre, codigo))
  )
`

// ── Órdenes ───────────────────────────────────────────────────────────────────

export function useOCsFinanzas() {
  return useQuery({
    queryKey: ['finanzas', 'ocs'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select(SELECT_OC)
        .order('creado_en', { ascending: false })
        .limit(500)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function sinFactura(oc) {
  return !oc.numero_factura || oc.numero_factura.trim() === ''
}

// Badge del sidebar — OCs sin factura
export function useOCsPendientesFactura() {
  const q = useOCsFinanzas()
  return { ...q, data: (q.data ?? []).filter(sinFactura) }
}

// ── Facturas ──────────────────────────────────────────────────────────────────

export function useFacturas() {
  return useQuery({
    queryKey: ['finanzas', 'facturas'],
    queryFn: async () => {
      const { data, error } = await db
        .from('facturas')
        .select(`
          id, numero, tipo_comprobante, punto_venta, cae, cae_vencimiento,
          fecha_emision, monto_total, estado, creado_en,
          ordenes_compra(
            id, numero,
            cotizaciones(
              clientes(razon_social),
              cotizacion_items(id, cantidad, lote_aplicado, productos(nombre, codigo))
            )
          )
        `)
        .order('creado_en', { ascending: false })
        .limit(300)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useEmitirFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ oc, tipoComprobante, puntoVenta, fechaVencimiento }) => {
      const pv = parseInt(puntoVenta)
      if (!pv || pv < 1 || pv > 9999) throw new Error('Punto de venta inválido (debe ser entre 1 y 9999)')

      const total = parseFloat(oc.cotizaciones?.total ?? 0)
      if (total <= 0) throw new Error('El total de la orden debe ser mayor a cero')

      const { data: { user } } = await supabase.auth.getUser()

      // Llamada a AFIP — si falla aquí, nada fue escrito en la DB
      const afipResult = await emitirFacturaAFIP({
        tipoComprobante,
        puntoVenta:   pv,
        importeTotal: total,
        cliente:  oc.cotizaciones?.clientes?.razon_social,
        ocNumero: oc.numero,
      })

      const nroFormatted = formatearNumeroFactura(
        tipoComprobante, pv, afipResult.numeroComprobante ?? Date.now()
      )

      // INSERT factura
      const { data: factura, error: facErr } = await db
        .from('facturas')
        .insert({
          oc_id:            oc.id,
          numero:           nroFormatted,
          tipo_comprobante: tipoComprobante,
          punto_venta:      pv,
          cae:              afipResult.cae,
          cae_vencimiento:  afipResult.caeVencimiento,
          fecha_emision:    new Date().toISOString().split('T')[0],
          monto_total:      total,
          estado:           'emitida',
          afip_response:    afipResult,
          creado_por:       user.id,
        })
        .select('id, numero')
        .single()
      if (facErr) throw new Error(`Factura AFIP obtenida (CAE: ${afipResult.cae}) pero falló el registro en el sistema: ${facErr.message}`)

      // UPDATE OC
      const ocUpdate = { numero_factura: nroFormatted }
      if (fechaVencimiento) ocUpdate.fecha_vencimiento_factura = fechaVencimiento
      const { error: ocErr } = await db
        .from('ordenes_compra')
        .update(ocUpdate)
        .eq('id', oc.id)
      if (ocErr) throw new Error(`Factura registrada pero no se pudo vincular a la OC: ${ocErr.message}`)

      return { factura, afipResult, fechaVencimiento }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })
}

// ── PDF de factura ────────────────────────────────────────────────────────────

export function useSubirFacturaPDF() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ facturaId, file }) => {
      const ext  = file.name.split('.').pop()
      const path = `${facturaId}.${ext}`
      const { error: upErr } = await db.storage
        .from('facturas')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = db.storage
        .from('facturas')
        .getPublicUrl(path)
      const { error: dbErr } = await db
        .from('facturas')
        .update({ pdf_url: publicUrl })
        .eq('id', facturaId)
      if (dbErr) throw dbErr
      return publicUrl
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas'] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })
}

// ── Estado de pago ────────────────────────────────────────────────────────────

export function useActualizarEstadoPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, estadoPago }) => {
      const { error } = await db
        .from('ordenes_compra')
        .update({ estado_pago: estadoPago })
        .eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas'] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })
}

// ── Estado de cuenta ──────────────────────────────────────────────────────────

export function useEstadoCuenta() {
  return useQuery({
    queryKey: ['finanzas', 'estado-cuenta'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select(SELECT_OC)
        .order('creado_en', { ascending: false })
        .limit(1000)
      if (error) throw error

      const byCliente = {}
      for (const oc of data ?? []) {
        const c = oc.cotizaciones?.clientes
        if (!c) continue
        if (!byCliente[c.id]) {
          byCliente[c.id] = { id: c.id, razon_social: c.razon_social, ocs: [] }
        }
        byCliente[c.id].ocs.push(oc)
      }

      return Object.values(byCliente).map(c => {
        const totalFacturado = c.ocs
          .filter(oc => oc.numero_factura)
          .reduce((s, oc) => s + (parseFloat(oc.cotizaciones?.total) || 0), 0)
        const totalPagado = c.ocs
          .filter(oc => oc.estado_pago === 'pagado')
          .reduce((s, oc) => s + (parseFloat(oc.cotizaciones?.total) || 0), 0)
        const saldoPendiente = c.ocs
          .filter(oc => ['pendiente', 'parcial'].includes(oc.estado_pago) && oc.numero_factura)
          .reduce((s, oc) => s + (parseFloat(oc.cotizaciones?.total) || 0), 0)
        return { ...c, totalFacturado, totalPagado, saldoPendiente, tieneDeuda: saldoPendiente > 0 }
      }).sort((a, b) => b.saldoPendiente - a.saldoPendiente)
    },
    staleTime: 1000 * 60,
  })
}

// Badge sidebar — clientes con deuda
export function useClientesConDeuda() {
  return useQuery({
    queryKey: ['finanzas', 'deuda-count'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select('cotizaciones(clientes(id))')
        .in('estado_pago', ['pendiente', 'parcial'])
        .not('numero_factura', 'is', null)
      if (error) return 0
      const ids = new Set(data?.map(oc => oc.cotizaciones?.clientes?.id).filter(Boolean))
      return ids.size
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ── Notas de crédito / débito ─────────────────────────────────────────────────

export function useNotasCredDebito() {
  return useQuery({
    queryKey: ['finanzas', 'notas'],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await db
        .from('notas_credito_debito')
        .select(`
          id, tipo, numero, monto, motivo, origen, estado, creado_en,
          solicitante:solicitado_por ( nombre ),
          ordenes_compra (
            id, numero,
            cotizaciones ( clientes (id, razon_social) )
          )
        `)
        .order('creado_en', { ascending: false })
        .limit(300)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useNotasPendientesCount() {
  const q = useNotasCredDebito()
  return (q.data ?? []).filter(n => n.estado === 'pendiente').length
}

export function useSolicitarNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tipo = 'credito', ocId, monto, motivo }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('notas_credito_debito')
        .insert({ tipo, oc_id: ocId ?? null, monto: parseFloat(monto) || 0, motivo, origen: 'reclamo', estado: 'pendiente', solicitado_por: user.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finanzas', 'notas'] }),
  })
}

export function useCrearNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tipo, ocId, monto, motivo }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const prefix = tipo === 'credito' ? 'NC' : 'ND'
      const numero = `${prefix}-${String(PUNTO_VENTA_DEFAULT).padStart(4, '0')}-${String(Date.now()).slice(-8)}`
      const { error } = await db
        .from('notas_credito_debito')
        .insert({ tipo, oc_id: ocId ?? null, monto: parseFloat(monto) || 0, motivo, origen: 'finanzas', estado: 'emitida', numero, solicitado_por: user.id })
      if (error) throw error
      return { numero }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finanzas', 'notas'] }),
  })
}

export function useEmitirNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ notaId, tipo }) => {
      const prefix = tipo === 'credito' ? 'NC' : 'ND'
      const numero = `${prefix}-${String(PUNTO_VENTA_DEFAULT).padStart(4, '0')}-${String(Date.now()).slice(-8)}`
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db
        .from('notas_credito_debito')
        .update({ estado: 'emitida', numero, aprobado_por: user.id })
        .eq('id', notaId)
      if (error) throw error
      return { numero }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finanzas', 'notas'] }),
  })
}

export function useAnularNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (notaId) => {
      const { error } = await db.from('notas_credito_debito').update({ estado: 'anulada' }).eq('id', notaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finanzas', 'notas'] }),
  })
}

// ── Pagos individuales ────────────────────────────────────────────────────────

export function usePagosOC(ocIds = []) {
  return useQuery({
    queryKey: ['finanzas', 'pagos', ocIds],
    enabled:  ocIds.length > 0,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await db
        .from('pagos')
        .select('id, oc_id, tipo, monto, fecha, nota, creado_en')
        .in('oc_id', ocIds)
        .order('fecha', { ascending: true })
      if (error) return []
      return data ?? []
    },
  })
}

export function useRegistrarPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, tipo, monto, fecha, nota, totalOC }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db.from('pagos').insert({
        oc_id:          ocId,
        tipo,
        monto:          parseFloat(monto),
        fecha,
        nota:           nota || null,
        registrado_por: user.id,
      })
      if (error) throw error

      // Recalcular estado_pago en base al total cobrado
      const { data: allPagos } = await db
        .from('pagos').select('monto').eq('oc_id', ocId)
      const totalCobrado = (allPagos ?? []).reduce((s, p) => s + parseFloat(p.monto), 0)
      const nuevoEstado  = totalCobrado >= parseFloat(totalOC) - 0.01
        ? 'pagado'
        : totalCobrado > 0
          ? 'parcial'
          : 'pendiente'
      await db.from('ordenes_compra').update({ estado_pago: nuevoEstado }).eq('id', ocId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas'] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })
}

export function useActualizarVencimientoFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, fechaVencimiento }) => {
      const { error } = await db
        .from('ordenes_compra')
        .update({ fecha_vencimiento_factura: fechaVencimiento || null })
        .eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finanzas'] }),
  })
}
