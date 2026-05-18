import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// AFIP - Facturación Electrónica (WSFE)
//
// Variables de entorno requeridas:
//   VITE_AFIP_ENABLED=true          → activa llamadas reales (false = modo stub)
//   VITE_AFIP_CUIT=20xxxxxxxx0      → CUIT del emisor (Fabriquímica)
//   VITE_AFIP_PUNTO_VENTA=1         → punto de venta por defecto
//
// Edge Function requerida: supabase/functions/afip/index.ts
//   Implementa WSAA + WSFE de AFIP usando certificado digital.
//   Parámetros de entrada (JSON): tipoComprobante, puntoVenta, cuitEmisor,
//   importeTotal, items[], cliente
//   Respuesta esperada: { cae, caeVencimiento, numeroComprobante, resultado }
//
//   Documentación AFIP:
//   https://www.afip.gob.ar/fe/documentos/manual_desarrollador_COMPG_v2_10.pdf
// ─────────────────────────────────────────────────────────────────────────────

export const PUNTO_VENTA_DEFAULT = parseInt(import.meta.env.VITE_AFIP_PUNTO_VENTA ?? '1')
export const CUIT_EMISOR         = import.meta.env.VITE_AFIP_CUIT ?? ''
export const AFIP_ENABLED        = import.meta.env.VITE_AFIP_ENABLED === 'true'

export const TIPOS_COMPROBANTE = [
  { value: 'A', label: 'Factura A', desc: 'Responsable inscripto (con IVA discriminado)' },
  { value: 'B', label: 'Factura B', desc: 'Consumidor final / exento' },
  { value: 'C', label: 'Factura C', desc: 'Monotributista' },
]

// Formatea el número de factura en el formato estándar AFIP: X-PPPP-NNNNNNNN
export function formatearNumeroFactura(tipo, puntoVenta, numero) {
  return `${tipo}-${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`
}

export async function emitirFacturaAFIP({ tipoComprobante, puntoVenta, importeTotal, cliente, ocNumero }) {
  if (!AFIP_ENABLED) {
    // Modo stub — simula respuesta aprobada de AFIP
    const cae = String(Math.floor(Math.random() * 1e14)).padStart(14, '0')
    const vto  = new Date(); vto.setDate(vto.getDate() + 10)
    return {
      ok:                true,
      cae,
      caeVencimiento:    vto.toISOString().split('T')[0],
      numeroComprobante: Math.floor(Math.random() * 1e7) + 1,
      resultado:         'A', // A = Aprobado
      stub:              true,
    }
  }

  // Llamada real via Supabase Edge Function
  const { data: { session } } = await supabase.auth.getSession()
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/afip`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      tipoComprobante,
      puntoVenta:   parseInt(puntoVenta),
      cuitEmisor:   CUIT_EMISOR,
      importeTotal: parseFloat(importeTotal),
      cliente,
      ocNumero,
    }),
  })
  if (!res.ok) throw new Error(`AFIP: ${await res.text()}`)
  return res.json()
}
