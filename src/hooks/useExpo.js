import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

const SELECT_PEDIDO = `
  id, numero, estado, cliente_nombre, pais_destino, cliente_id, cotizacion_id, puerto_descarga,
  tipo_envase, incoterm,
  cantidad_total_kg, cantidad_envases, cantidad_pallets,
  peso_neto, peso_bruto, apilable, notas_vendedor, notas_produccion,
  flete_usd, seguro_usd, otros_gastos_usd,
  cotizado_en, creado_en,
  creado_por_perfil:creado_por(nombre),
  cotizado_por_perfil:cotizado_por(nombre),
  cliente:cliente_id(id, razon_social, pais, es_exterior),
  cotizacion:cotizacion_id(id, estado, codigo),
  pedidos_expo_items(
    id, producto_id, producto_nombre, cantidad_kg, precio_usd, subtotal_usd,
    tipo_envase, capacidad_tambor, tipo_pallet,
    cantidad_envases, cantidad_pallets, peso_neto, peso_bruto, apilable
  )
`

// ── Catálogo para vendedor expo ───────────────────────────────────────────────

export function useCatalogoExpo() {
  return useQuery({
    queryKey: ['expo', 'catalogo'],
    queryFn: async () => {
      const { data, error } = await db
        .from('productos')
        .select('id, codigo, nombre, presentacion, precios_actuales(lista1_may, lista4_std, lista3_min)')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ── Pedidos del vendedor expo ─────────────────────────────────────────────────

export function usePedidosExpo({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['expo', 'pedidos'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await db
        .from('pedidos_expo')
        .select(SELECT_PEDIDO)
        .eq('creado_por', user.id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled,
    staleTime: 1000 * 30,
  })
}

// ── Pedidos para COMEX ────────────────────────────────────────────────────────

export function usePedidosComex() {
  return useQuery({
    queryKey: ['comex', 'solicitudes'],
    queryFn: async () => {
      const { data, error } = await db
        .from('pedidos_expo')
        .select(SELECT_PEDIDO)
        .in('estado', ['pendiente_comex', 'cotizado', 'aprobado', 'cancelado'])
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function usePedidosComexPendientesCount() {
  const q = usePedidosComex()
  return (q.data ?? []).filter(p => p.estado === 'pendiente_comex').length
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function generarNumeroExpo() {
  const year = new Date().getFullYear()
  const seq  = String(Date.now()).slice(-5)
  return `EXPO-${year}-${seq}`
}

export function useCrearPedidoExpo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clienteNombre, paisDestino, puertoDescarga, tipoEnvase, incoterm, cantidadTotalKg,
      cantidadEnvases, cantidadPallets, pesoNeto, pesoBruto, apilable,
      notasVendedor, items,
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const numero = generarNumeroExpo()

      const { data: pedido, error } = await db
        .from('pedidos_expo')
        .insert({
          numero,
          estado:            'borrador',
          cliente_nombre:    clienteNombre,
          pais_destino:      paisDestino        || null,
          puerto_descarga:   puertoDescarga     || null,
          tipo_envase:       tipoEnvase         || null,
          incoterm,
          cantidad_total_kg: cantidadTotalKg,
          cantidad_envases:  cantidadEnvases    || null,
          cantidad_pallets:  cantidadPallets    || null,
          peso_neto:         pesoNeto           || null,
          peso_bruto:        pesoBruto          || null,
          apilable:          apilable           || null,
          notas_vendedor:    notasVendedor      || null,
          creado_por:        user.id,
        })
        .select('id, numero')
        .single()
      if (error) throw error

      if (items?.length > 0) {
        const { error: itemErr } = await db
          .from('pedidos_expo_items')
          .insert(items.map(it => ({
            pedido_id:        pedido.id,
            producto_id:      it.productoId      ?? null,
            producto_nombre:  it.productoNombre,
            cantidad_kg:      parseFloat(it.cantidadKg) || 0,
            precio_usd:       it.precioUsd       ? parseFloat(it.precioUsd)   : null,
            subtotal_usd:     it.subtotalUsd     ? parseFloat(it.subtotalUsd) : null,
            tipo_envase:      it.tipoEfectivo    ?? null,
            capacidad_tambor: (it.tipoEfectivo === 'tambor' || it.tipoEfectivo === 'tambor_bin') ? (it.capacidadTambor ?? 200) : null,
            tipo_pallet:      it.palletEfectivo  ?? null,
            cantidad_envases: it.dim?.envases    ?? null,
            cantidad_pallets: it.dim?.pallets    ?? null,
            peso_neto:        it.dim?.neto       ?? null,
            peso_bruto:       it.dim?.bruto      ?? null,
            apilable:         it.dim?.apilable   ?? null,
          })))
        if (itemErr) throw itemErr
      }

      return pedido
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo'] }),
  })
}

export function useEnviarAProduccion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, incoterm }) => {
      const patch = { estado: 'pendiente_produccion' }
      if (incoterm) patch.incoterm = incoterm
      const { error } = await db
        .from('pedidos_expo')
        .update(patch)
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo'] }),
  })
}

export function useAprobarDimensionamiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, notasProduccion }) => {
      const { error } = await db
        .from('pedidos_expo')
        .update({ estado: 'pendiente_comex', notas_produccion: notasProduccion || null })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expo'] })
      qc.invalidateQueries({ queryKey: ['comex'] })
    },
  })
}

export function useRechazarDimensionamiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, notasProduccion }) => {
      const { error } = await db
        .from('pedidos_expo')
        .update({ estado: 'borrador', notas_produccion: notasProduccion || null })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo'] }),
  })
}

// ── Pedidos para Producción ───────────────────────────────────────────────────

export function usePedidosExpoProduccion() {
  return useQuery({
    queryKey: ['expo', 'produccion'],
    queryFn: async () => {
      const { data, error } = await db
        .from('pedidos_expo')
        .select(SELECT_PEDIDO)
        .eq('estado', 'pendiente_produccion')
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })
}

export function usePedidosExpoProduccionCount() {
  const q = usePedidosExpoProduccion()
  return (q.data ?? []).length
}

export function useGuardarCostosComex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, fleteUsd, seguroUsd, otrosGastosUsd, items }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const totalKg     = items.reduce((s, it) => s + (parseFloat(it.cantidad_kg) || 0), 0)
      const totalExtras = (parseFloat(fleteUsd) || 0) + (parseFloat(seguroUsd) || 0) + (parseFloat(otrosGastosUsd) || 0)
      const extraPerKg  = totalKg > 0 ? totalExtras / totalKg : 0

      for (const it of items) {
        const kg          = parseFloat(it.cantidad_kg) || 0
        const precioBase  = parseFloat(it.precio_base) || 0
        const precioFinal = precioBase + extraPerKg
        const subFinal    = precioFinal * kg
        const { error } = await db
          .from('pedidos_expo_items')
          .update({
            precio_usd:   precioFinal > 0 ? precioFinal : null,
            subtotal_usd: subFinal    > 0 ? subFinal    : null,
          })
          .eq('id', it.id)
        if (error) throw error
      }

      const { error } = await db
        .from('pedidos_expo')
        .update({
          flete_usd:        parseFloat(fleteUsd)        || null,
          seguro_usd:       parseFloat(seguroUsd)       || null,
          otros_gastos_usd: parseFloat(otrosGastosUsd)  || null,
          estado:           'cotizado',
          cotizado_por:     user.id,
          cotizado_en:      new Date().toISOString(),
        })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expo'] })
      qc.invalidateQueries({ queryKey: ['comex'] })
    },
  })
}

export function useActualizarPreciosExpo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ items }) => {
      for (const it of items) {
        const { error } = await db
          .from('pedidos_expo_items')
          .update({ precio_usd: it.precio_usd ?? null, subtotal_usd: it.subtotal_usd ?? null })
          .eq('id', it.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo'] }),
  })
}

export function useAprobarPedidoExpo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId) => {
      const { error } = await db
        .from('pedidos_expo')
        .update({ estado: 'aprobado' })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expo'] })
      qc.invalidateQueries({ queryKey: ['comex'] })
    },
  })
}

export function useCancelarPedidoExpo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId) => {
      const { error } = await db
        .from('pedidos_expo')
        .update({ estado: 'cancelado' })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expo'] })
      qc.invalidateQueries({ queryKey: ['comex'] })
    },
  })
}

// ── Clientes para vendedor expo ───────────────────────────────────────────────

export function useClientesExpo() {
  return useQuery({
    queryKey: ['expo', 'clientes'],
    queryFn: async () => {
      const { data, error } = await db
        .from('clientes')
        .select('id, razon_social, pais, es_exterior, estado')
        .in('estado', ['activo', 'pendiente'])
        .order('razon_social')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useCrearClienteExterior() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ razonSocial, pais }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: vendedor } = await db
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      const { data, error } = await db
        .from('clientes')
        .insert({ razon_social: razonSocial, pais, es_exterior: true, estado: 'pendiente', vendedor_id: vendedor?.id ?? null })
        .select('id, razon_social, pais, es_exterior')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo', 'clientes'] }),
  })
}

// ── Conversión del pedido expo a cotización doméstica ─────────────────────────

export function useConvertirACotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, clienteId, items, observaciones }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Vendedor record (vendedor_expo debe tener registro en vendedores)
      const { data: vendedor, error: vErr } = await db
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()
      if (vErr) throw vErr
      if (!vendedor) throw new Error('El usuario no tiene un registro de vendedor. Pedile al administrador que lo configure.')

      // Totales (sin IVA — exportación)
      const subtotal = items.reduce((s, it) => s + (parseFloat(it.subtotal_usd) || 0), 0)

      const year    = new Date().getFullYear()
      const codigo  = `COT-EXPO-${year}-${String(Date.now()).slice(-5)}`
      const venc    = new Date()
      venc.setDate(venc.getDate() + 30)

      // Crear cotización
      const { data: cot, error: cotErr } = await db
        .from('cotizaciones')
        .insert({
          codigo,
          cliente_id:   clienteId,
          vendedor_id:  vendedor.id,
          moneda:       'USD',
          fecha:        new Date().toISOString().split('T')[0],
          vencimiento:  venc.toISOString().split('T')[0],
          validez_dias: 30,
          subtotal,
          iva:          0,
          total:        subtotal,
          observaciones: observaciones || null,
          estado:       'espera',
          creado_por:   user.id,
        })
        .select('id')
        .single()
      if (cotErr) throw cotErr

      // Items de la cotización (sólo los que tienen producto_id)
      const cotItems = items
        .filter(it => it.producto_id)
        .map((it, idx) => ({
          cotizacion_id:   cot.id,
          producto_id:     it.producto_id,
          cantidad:        parseFloat(it.cantidad_kg),
          precio_unitario: parseFloat(it.precio_usd) || 0,
          moneda:          'USD',
          posicion:        idx + 1,
        }))
      if (cotItems.length > 0) {
        const { error: itmErr } = await db.from('cotizacion_items').insert(cotItems)
        if (itmErr) throw itmErr
      }

      // Actualizar precios en pedidos_expo_items
      for (const it of items) {
        await db.from('pedidos_expo_items')
          .update({ precio_usd: it.precio_usd ?? null, subtotal_usd: it.subtotal_usd ?? null })
          .eq('id', it.id)
      }

      // Marcar pedido expo como aprobado y vincularlo
      const { error: pedErr } = await db
        .from('pedidos_expo')
        .update({ estado: 'aprobado', cotizacion_id: cot.id, cliente_id: clienteId })
        .eq('id', pedidoId)
      if (pedErr) throw pedErr

      return cot
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expo'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

// ── Producción modifica ítems de dimensionamiento ─────────────────────────────

export function useModificarItemsDimensionamiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ items }) => {
      for (const { id, ...updates } of items) {
        const { error } = await db.from('pedidos_expo_items').update(updates).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo'] }),
  })
}

// Sincroniza las líneas de envase: insert nuevas, update existentes, delete eliminadas
export function useSincronizarLineas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, lineas, idsEliminar }) => {
      if (idsEliminar?.length) {
        const { error } = await db.from('pedidos_expo_items').delete().in('id', idsEliminar)
        if (error) throw error
      }
      for (const l of lineas.filter(l => l.itemId != null)) {
        const patch = {
          cantidad_kg:      l.cantidad_kg,
          tipo_envase:      l.tipo_envase,
          capacidad_tambor: l.capacidad_tambor,
          tipo_pallet:      l.tipo_pallet,
          cantidad_envases: l.cantidad_envases,
          cantidad_pallets: l.cantidad_pallets,
          peso_neto:        l.peso_neto,
          peso_bruto:       l.peso_bruto,
          apilable:         l.apilable,
        }
        if (l.precio_usd != null) patch.precio_usd = l.precio_usd
        const { error } = await db.from('pedidos_expo_items').update(patch).eq('id', l.itemId)
        if (error) throw error
      }
      const nuevas = lineas.filter(l => l.itemId == null)
      if (nuevas.length) {
        const { error } = await db.from('pedidos_expo_items').insert(
          nuevas.map(l => ({
            pedido_id:        pedidoId,
            producto_id:      l.productoId,
            producto_nombre:  l.productoNombre,
            cantidad_kg:      l.cantidad_kg,
            tipo_envase:      l.tipo_envase,
            capacidad_tambor: l.capacidad_tambor,
            tipo_pallet:      l.tipo_pallet,
            cantidad_envases: l.cantidad_envases,
            cantidad_pallets: l.cantidad_pallets,
            peso_neto:        l.peso_neto,
            peso_bruto:       l.peso_bruto,
            apilable:         l.apilable,
            precio_usd:       l.precio_usd ?? null,
          }))
        )
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expo'] }),
  })
}

// ── Vendedor expo recotiza (reemplaza cotización existente en revisión) ────────

export function useRecotizarExpo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, clienteId, items, observaciones }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: pedido } = await db
        .from('pedidos_expo').select('cotizacion_id').eq('id', pedidoId).single()

      if (pedido?.cotizacion_id) {
        await db.from('cotizaciones').update({ estado: 'perdida' }).eq('id', pedido.cotizacion_id)
      }

      const { data: vendedor, error: vErr } = await db
        .from('vendedores').select('id').eq('perfil_id', user.id).maybeSingle()
      if (vErr) throw vErr
      if (!vendedor) throw new Error('El usuario no tiene registro de vendedor.')

      const subtotal = items.reduce((s, it) => s + (parseFloat(it.subtotal_usd) || 0), 0)
      const year = new Date().getFullYear()
      const codigo = `COT-EXPO-${year}-${String(Date.now()).slice(-5)}`
      const venc = new Date(); venc.setDate(venc.getDate() + 30)

      const { data: cot, error: cotErr } = await db.from('cotizaciones').insert({
        codigo, cliente_id: clienteId, vendedor_id: vendedor.id,
        moneda: 'USD', fecha: new Date().toISOString().split('T')[0],
        vencimiento: venc.toISOString().split('T')[0], validez_dias: 30,
        subtotal, iva: 0, total: subtotal,
        observaciones: observaciones || null, estado: 'espera', creado_por: user.id,
      }).select('id').single()
      if (cotErr) throw cotErr

      const cotItems = items.filter(it => it.producto_id).map((it, idx) => ({
        cotizacion_id: cot.id, producto_id: it.producto_id,
        cantidad: parseFloat(it.cantidad_kg), precio_unitario: parseFloat(it.precio_usd) || 0,
        moneda: 'USD', posicion: idx + 1,
      }))
      if (cotItems.length > 0) {
        const { error: itmErr } = await db.from('cotizacion_items').insert(cotItems)
        if (itmErr) throw itmErr
      }

      for (const it of items) {
        await db.from('pedidos_expo_items')
          .update({ precio_usd: it.precio_usd ?? null, subtotal_usd: it.subtotal_usd ?? null })
          .eq('id', it.id)
      }

      const { error: pedErr } = await db.from('pedidos_expo')
        .update({ cotizacion_id: cot.id })
        .eq('id', pedidoId)
      if (pedErr) throw pedErr

      return cot
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expo'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}


// ── Precios del listado local (misma tabla que pedidos locales) ───────────────

export function usePreciosExpo(productoIds) {
  return useQuery({
    queryKey: ['precios_expo', productoIds],
    queryFn: async () => {
      if (!productoIds?.length) return {}
      const { data, error } = await db
        .from('precios_actuales')
        .select('producto_id, lista1_may, lista4_std, lista3_min')
        .in('producto_id', productoIds)
      if (error) throw error
      return Object.fromEntries((data ?? []).map(p => [p.producto_id, p]))
    },
    enabled: !!productoIds?.length,
    staleTime: 5 * 60 * 1000,
  })
}
