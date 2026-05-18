import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

// Usa supabaseAdmin para bypassear RLS y ver TODOS los códigos existentes.
// Sin esto, cada cliente solo ve sus propios registros y genera códigos duplicados.
const db = supabaseAdmin ?? supabase

async function generarCodigo(tabla, campo, prefijo) {
  const anio = new Date().getFullYear()
  const { data } = await db
    .from(tabla)
    .select(campo)
    .like(campo, `${prefijo}-${anio}-%`)
    .order(campo, { ascending: false })
    .limit(1)
    .single()

  const siguiente = data
    ? parseInt(data[campo].split('-')[2], 10) + 1
    : 1

  return `${prefijo}-${anio}-${String(siguiente).padStart(4, '0')}`
}

export const generarCodigoCotizacion = () => generarCodigo('cotizaciones', 'codigo', 'COT')
export const generarCodigoSolicitud   = () => generarCodigo('solicitudes',  'codigo', 'SOL')
export const generarCodigoOrden       = () => generarCodigo('ordenes_compra','numero', 'OC')
