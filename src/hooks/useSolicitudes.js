import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { generarCodigoSolicitud, generarCodigoCotizacion } from '../utils/codigoGenerator'
import { calcularTotales } from '../utils/calc'

const db = supabaseAdmin ?? supabase

// ── datos del cliente actual (para detectar es_exterior) ──────────────────────
export function useClienteActual() {
  return useQuery({
    queryKey: ['cliente', 'actual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: cu } = await supabase
        .from('clientes_usuarios').select('cliente_id').eq('perfil_id', user.id).maybeSingle()
      if (!cu?.cliente_id) return null
      const { data } = await supabase
        .from('clientes').select('id, razon_social, es_exterior, pais').eq('id', cu.cliente_id).single()
      return data ?? null
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ── cliente: sus solicitudes ───────────────────────────────────────────────────
export function useSolicitudesCliente() {
  return useQuery({
    queryKey: ['solicitudes', 'cliente'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: cu } = await supabase
        .from('clientes_usuarios')
        .select('cliente_id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!cu?.cliente_id) return []

      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          id, codigo, estado, observaciones, creado_en,
          solicitud_items (
            id, producto_id, cantidad, notas
          )
        `)
        .eq('cliente_id', cu.cliente_id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

// ── vendedor: solicitudes de los clientes asignados a este vendedor ───────────
export function useSolicitudesVendedor() {
  return useQuery({
    queryKey: ['solicitudes', 'vendedor'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: vend } = await supabase
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!vend) return []

      // Un solo query con !inner join — sin la ida intermedia a clientes
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          id, codigo, estado, observaciones, creado_en,
          clientes!inner(id, razon_social, vendedor_id),
          solicitud_items (
            id, producto_id, cantidad, notas,
            productos (id, codigo, nombre, presentacion)
          )
        `)
        .eq('clientes.vendedor_id', vend.id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

// ── cargar una solicitud individual (para pre-cargar el cotizador) ─────────────
export function useSolicitud(id) {
  return useQuery({
    queryKey: ['solicitud', id],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          id, codigo, cliente_id, estado, observaciones,
          clientes (id, razon_social),
          solicitud_items (
            id, producto_id, cantidad, notas,
            productos (id, codigo, nombre, presentacion, precios_actuales(lista1_may, lista4_std, lista3_min))
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// ── cliente: crear solicitud ───────────────────────────────────────────────────
export function useCrearSolicitud() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ items, observaciones, incoterm, puerto_descarga }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: cu } = await db
        .from('clientes_usuarios')
        .select('cliente_id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!cu?.cliente_id) {
        throw new Error('No se encontró el perfil de cliente para este usuario. Contactá al administrador.')
      }

      let vendedorId = null
      const { data: cli } = await db
        .from('clientes')
        .select('vendedor_id')
        .eq('id', cu.cliente_id)
        .single()
      vendedorId = cli?.vendedor_id ?? null

      let sol, errSol
      for (let intento = 0; intento < 5; intento++) {
        const codigo = await generarCodigoSolicitud()
        ;({ data: sol, error: errSol } = await db
          .from('solicitudes')
          .insert({
            codigo,
            estado:        'pendiente',
            observaciones: observaciones  || null,
            cliente_id:    cu?.cliente_id ?? null,
            vendedor_id:   vendedorId,
            ...(incoterm        ? { incoterm }        : {}),
            ...(puerto_descarga ? { puerto_descarga } : {}),
          })
          .select('id, codigo')
          .single())
        if (!errSol || !errSol.message?.includes('duplicate key')) break
      }
      if (errSol) throw errSol

      const { error: errItems } = await supabase
        .from('solicitud_items')
        .insert(items.map(it => ({
          solicitud_id: sol.id,
          producto_id:  it.producto_id,
          cantidad:     it.cantidad,
          notas:        it.notas ?? null,
        })))

      if (errItems) throw errItems

      // ── Pedido expo automático para clientes del exterior ─────────────────
      let esExterior = false
      if (cu?.cliente_id) {
        const { data: clienteData } = await db
          .from('clientes')
          .select('es_exterior, pais, razon_social, vendedor_id')
          .eq('id', cu.cliente_id)
          .single()
        esExterior = clienteData?.es_exterior ?? false

        if (clienteData?.es_exterior && clienteData.vendedor_id) {
          // Necesitamos el perfil_id (UUID) del vendedor para creado_por
          const { data: vendedorData } = await db
            .from('vendedores')
            .select('perfil_id')
            .eq('id', clienteData.vendedor_id)
            .single()

          if (vendedorData?.perfil_id) {
            const numero = `EXPO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
            const totalKgExpo = items.reduce((s, it) => s + (it.cantidad || 0), 0)

            const { data: pedidoExpo, error: errExpo } = await db
              .from('pedidos_expo')
              .insert({
                numero,
                estado:            'borrador',
                cliente_id:        cu.cliente_id,
                cliente_nombre:    clienteData.razon_social,
                pais_destino:      clienteData.pais ?? null,
                incoterm:          incoterm         || null,
                puerto_descarga:   puerto_descarga  || null,
                cantidad_total_kg: totalKgExpo,
                notas_vendedor:    observaciones    || null,
                creado_por:        vendedorData.perfil_id,
              })
              .select('id')
              .single()
            if (errExpo) throw errExpo

            if (pedidoExpo) {
              // Obtener nombres de productos para pedidos_expo_items
              const { data: prods } = await db
                .from('productos')
                .select('id, nombre')
                .in('id', items.map(it => it.producto_id))

              const nombresMap = Object.fromEntries((prods ?? []).map(p => [p.id, p.nombre]))

              await db.from('pedidos_expo_items').insert(
                items.map(it => ({
                  pedido_id:       pedidoExpo.id,
                  producto_id:     it.producto_id,
                  producto_nombre: nombresMap[it.producto_id] ?? '',
                  cantidad_kg:     it.cantidad,
                }))
              )
            }
          }
        }
      }

      // ── Auto-cotización para pedidos < 200 kg (solo clientes nacionales) ──
      const totalKg = items.reduce((s, it) => s + (it.cantidad || 0), 0)
      if (totalKg < 200 && !esExterior) {
        const productoIds = items.map(it => it.producto_id)

        const { data: precios } = await supabase
          .from('precios_actuales')
          .select('producto_id, lista1_may, lista4_std, lista3_min')
          .in('producto_id', productoIds)

        // Validar que todos los productos tengan precio válido
        const sinPrecio = items.filter(it => {
          const p = precios?.find(pr => pr.producto_id === it.producto_id)
          return !p || !p.lista3_min || p.lista3_min <= 0
        })
        if (sinPrecio.length > 0) {
          // No lanzar error: dejar la solicitud creada para que vendedor cotice manualmente
          await supabase
            .from('solicitudes')
            .update({ estado: 'pendiente' })
            .eq('id', sol.id)
          return { ...sol, autoCotizacion: null, sinPrecio: true }
        }

        const cotItems = items.map(it => {
          const p = precios.find(pr => pr.producto_id === it.producto_id)
          return {
            producto_id:     it.producto_id,
            cantidad:        it.cantidad,
            precio_unitario: p.lista3_min,
            lista1_snapshot: p.lista1_may ?? null,
            lista4_snapshot: p.lista4_std ?? null,
            lista3_snapshot: p.lista3_min,
          }
        })

        const { subtotal, iva, total } = calcularTotales(cotItems)

        const codCot      = await generarCodigoCotizacion()
        const vencimiento = new Date()
        vencimiento.setDate(vencimiento.getDate() + 5)

        const db = supabaseAdmin ?? supabase

        const { data: cot, error: errCot } = await db
          .from('cotizaciones')
          .insert({
            codigo:        codCot,
            cliente_id:    cu.cliente_id,
            vendedor_id:   vendedorId,
            estado:        'espera',
            moneda:        'USD',
            validez_dias:  5,
            vencimiento:   vencimiento.toISOString().split('T')[0],
            observaciones: 'Cotización automática — pedido menor a 200 kg (precios minoristas)',
            subtotal,
            iva,
            total,
            solicitud_id:  sol.id,
          })
          .select('id, codigo')
          .single()

        if (errCot) throw errCot

        const { error: errCotItems } = await db
          .from('cotizacion_items')
          .insert(cotItems.map((it, idx) => ({
            ...it,
            cotizacion_id: cot.id,
            posicion:      idx + 1,
          })))
        if (errCotItems) throw errCotItems

        await db
          .from('solicitudes')
          .update({ estado: 'cotizada' })
          .eq('id', sol.id)

        return { ...sol, autoCotizacion: cot }
      }

      return sol
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'alertas'] })
    },
  })
}
