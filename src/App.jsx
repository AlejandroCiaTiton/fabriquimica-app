import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { queryClient } from './lib/queryClient'

const Login               = lazy(() => import('./pages/Login'))
const Registro            = lazy(() => import('./pages/Registro'))
const RecuperarContrasena = lazy(() => import('./pages/RecuperarContrasena'))
const NuevaContrasena     = lazy(() => import('./pages/NuevaContrasena'))
const VendedorLayout  = lazy(() => import('./pages/vendedor/VendedorLayout'))
const StockVendedor   = lazy(() => import('./pages/vendedor/StockVendedor'))
const NuevaCotizacion = lazy(() => import('./pages/vendedor/NuevaCotizacion'))
const Cotizaciones    = lazy(() => import('./pages/vendedor/Cotizaciones'))
const Solicitudes     = lazy(() => import('./pages/vendedor/Solicitudes'))
const OrdenesCopra      = lazy(() => import('./pages/vendedor/OrdenesCopra'))
const MuestrasVendedor  = lazy(() => import('./pages/vendedor/MuestrasVendedor'))
const Estadisticas    = lazy(() => import('./pages/vendedor/Estadisticas'))
const PlanVentas      = lazy(() => import('./pages/vendedor/PlanVentas'))
const AltaVendedor    = lazy(() => import('./pages/vendedor/AltaVendedor'))
const Delegacion             = lazy(() => import('./pages/vendedor/Delegacion'))
const ConfirmacionClientes   = lazy(() => import('./pages/vendedor/ConfirmacionClientes'))
const AsignacionClientes     = lazy(() => import('./pages/vendedor/AsignacionClientes'))
const ClienteLayout   = lazy(() => import('./pages/cliente/ClienteLayout'))
const NuevaSolicitud  = lazy(() => import('./pages/cliente/NuevaSolicitud'))
const MisCotizaciones = lazy(() => import('./pages/cliente/MisCotizaciones'))
const OCEnCurso       = lazy(() => import('./pages/cliente/OCEnCurso'))
const OCCompletadas   = lazy(() => import('./pages/cliente/OCCompletadas'))
const PerfilEmpresa   = lazy(() => import('./pages/cliente/PerfilEmpresa'))
const MuestrasCliente = lazy(() => import('./pages/cliente/MuestrasCliente'))
const AdminLayout     = lazy(() => import('./pages/admin/AdminLayout'))
const Precios         = lazy(() => import('./pages/admin/Precios'))
const Stock           = lazy(() => import('./pages/admin/Stock'))
const MaestroClientes = lazy(() => import('./pages/admin/MaestroClientes'))
const GestionUsuarios = lazy(() => import('./pages/admin/GestionUsuarios'))
const Contratipos        = lazy(() => import('./pages/admin/Contratipos'))
const ZonasEntrega       = lazy(() => import('./pages/admin/ZonasEntrega'))
const ProduccionLayout     = lazy(() => import('./pages/produccion/ProduccionLayout'))
const RegistrarProduccion  = lazy(() => import('./pages/produccion/RegistrarProduccion'))
const OrdenesProduccion    = lazy(() => import('./pages/produccion/OrdenesProduccion'))
const Planificacion        = lazy(() => import('./pages/produccion/Planificacion'))
const CalendarioProduccion = lazy(() => import('./pages/produccion/CalendarioProduccion'))
const AprobarExpo          = lazy(() => import('./pages/produccion/AprobarExpo'))
const FinanzasLayout       = lazy(() => import('./pages/finanzas/FinanzasLayout'))
const OrdenesFacturar      = lazy(() => import('./pages/finanzas/OrdenesFacturar'))
const FacturasEmitidas     = lazy(() => import('./pages/finanzas/FacturasEmitidas'))
const NotasCreditoDebito   = lazy(() => import('./pages/finanzas/NotasCreditoDebito'))
const EstadoCuenta         = lazy(() => import('./pages/finanzas/EstadoCuenta'))
const HistoricoCompras     = lazy(() => import('./pages/comercial/HistoricoCompras'))
const DirectorioClientes   = lazy(() => import('./pages/comercial/DirectorioClientes'))
const LogisticaLayout      = lazy(() => import('./pages/logistica/LogisticaLayout'))
const MapaEntregas         = lazy(() => import('./pages/logistica/MapaEntregas'))
const PlanDiario           = lazy(() => import('./pages/logistica/PlanDiario'))
const RecepcionMercaderia  = lazy(() => import('./pages/logistica/RecepcionMercaderia'))
const ChoferLayout         = lazy(() => import('./pages/chofer/ChoferLayout'))
const EntregasChofer       = lazy(() => import('./pages/chofer/EntregasChofer'))
const MapaChofer           = lazy(() => import('./pages/chofer/MapaChofer'))
const NuevaCotizacionExpo  = lazy(() => import('./pages/vendedorExpo/NuevaCotizacionExpo'))
const CotizacionesExpo     = lazy(() => import('./pages/vendedorExpo/CotizacionesExpo'))
const AltaEmpresaVendedor  = lazy(() => import('./pages/vendedor/AltaEmpresaVendedor'))
const ComexLayout          = lazy(() => import('./pages/comex/ComexLayout'))
const SolicitudesComex     = lazy(() => import('./pages/comex/SolicitudesComex'))
const DepositoLayout       = lazy(() => import('./pages/deposito/DepositoLayout'))
const CronogramaDeposito   = lazy(() => import('./pages/deposito/CronogramaDeposito'))
const LaboratorioLayout    = lazy(() => import('./pages/laboratorio/LaboratorioLayout'))
const CoasLaboratorio      = lazy(() => import('./pages/laboratorio/CoasLaboratorio'))
const MuestrasLaboratorio  = lazy(() => import('./pages/laboratorio/MuestrasLaboratorio'))
const ContratiposLaboratorio = lazy(() => import('./pages/laboratorio/ContratiposLaboratorio'))
const DesarrollosLaboratorio  = lazy(() => import('./pages/laboratorio/DesarrollosLaboratorio'))
const DocumentosLaboratorio   = lazy(() => import('./pages/laboratorio/DocumentosLaboratorio'))
const Transportistas       = lazy(() => import('./pages/logistica/Transportistas'))
const CronogramaEnvios     = lazy(() => import('./pages/logistica/CronogramaEnvios'))
const AsistenteLayout      = lazy(() => import('./pages/asistente/AsistenteLayout'))
const OrdenesAsistente     = lazy(() => import('./pages/asistente/OrdenesAsistente'))


function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function RutaProtegida({ children, roles }) {
  const { isAuthenticated, isLoading, perfil } = useAuth()

  if (isLoading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (perfil?.debe_cambiar_pass) return <Navigate to="/nueva-contrasena" replace />
  if (roles && perfil && !roles.includes(perfil.tipo)) return <Navigate to="/" replace />

  return children
}

function RedirectPorRol() {
  const { perfil, isLoading } = useAuth()

  if (isLoading) return null
  if (!perfil) return <Navigate to="/login" replace />

  if (perfil.tipo === 'admin')         return <Navigate to="/admin/precios" replace />
  if (perfil.tipo === 'vendedor')      return <Navigate to="/vendedor/stock" replace />
  if (perfil.tipo === 'finanzas')      return <Navigate to="/finanzas/facturar" replace />
  if (perfil.tipo === 'cliente')       return <Navigate to="/cliente/nueva-solicitud" replace />
  if (perfil.tipo === 'logistica')     return <Navigate to="/logistica/mapa" replace />
  if (perfil.tipo === 'produccion')    return <Navigate to="/produccion/producir" replace />
  if (perfil.tipo === 'chofer')        return <Navigate to="/chofer/entregas" replace />
  if (perfil.tipo === 'vendedor_expo') return <Navigate to="/vendedor/stock" replace />
  if (perfil.tipo === 'comex')         return <Navigate to="/comex/solicitudes" replace />
  if (perfil.tipo === 'deposito')      return <Navigate to="/deposito/cronograma" replace />
  if (perfil.tipo === 'laboratorio')   return <Navigate to="/laboratorio/coas" replace />
  if (perfil.tipo === 'asistente_ventas') return <Navigate to="/asistente/ordenes" replace />

  return <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login"             element={<Login />} />
        <Route path="/registro"          element={<Registro />} />
        <Route path="/recuperar"         element={<RecuperarContrasena />} />
        <Route path="/nueva-contrasena"  element={<NuevaContrasena />} />

        <Route path="/" element={
          <RutaProtegida>
            <RedirectPorRol />
          </RutaProtegida>
        } />

        {/* Vendedor */}
        <Route path="/vendedor" element={
          <RutaProtegida roles={['vendedor', 'vendedor_expo']}>
            <VendedorLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="stock" replace />} />
          <Route path="stock"            element={<StockVendedor />} />
          <Route path="estado-cuenta"    element={<EstadoCuenta />} />
          <Route path="solicitudes"      element={<Solicitudes />} />
          <Route path="cotizaciones"     element={<Cotizaciones />} />
          <Route path="nueva-cotizacion" element={<NuevaCotizacion />} />
          <Route path="ordenes"          element={<OrdenesCopra />} />
          <Route path="historico"        element={<HistoricoCompras />} />
          <Route path="directorio"       element={<DirectorioClientes />} />
          <Route path="estadisticas"     element={<Estadisticas />} />
          <Route path="plan"             element={<PlanVentas />} />
          <Route path="alta-vendedor"          element={<AltaVendedor />} />
          <Route path="delegacion"             element={<Delegacion />} />
          <Route path="confirmacion-clientes"  element={<ConfirmacionClientes />} />
          <Route path="asignacion-clientes"   element={<AsignacionClientes />} />
          <Route path="expo-cotizaciones"    element={<CotizacionesExpo />} />
          <Route path="expo-nueva"           element={<NuevaCotizacionExpo />} />
          <Route path="alta-empresa"         element={<AltaEmpresaVendedor />} />
          <Route path="muestras"             element={<MuestrasVendedor />} />
        </Route>

        {/* Cliente */}
        <Route path="/cliente" element={
          <RutaProtegida roles={['cliente']}>
            <ClienteLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="nueva-solicitud" replace />} />
          <Route path="nueva-solicitud" element={<NuevaSolicitud />} />
          <Route path="cotizaciones"    element={<MisCotizaciones />} />
          <Route path="oc-en-curso"     element={<OCEnCurso />} />
          <Route path="oc-completadas"  element={<OCCompletadas />} />
          <Route path="muestras"        element={<MuestrasCliente />} />
          <Route path="mi-empresa"      element={<PerfilEmpresa />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={
          <RutaProtegida roles={['admin']}>
            <AdminLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="precios" replace />} />
          <Route path="precios"          element={<Precios />} />
          <Route path="stock"            element={<Stock />} />
          <Route path="clientes"         element={<MaestroClientes />} />
          <Route path="solicitudes-alta" element={<ConfirmacionClientes />} />
          <Route path="usuarios"         element={<GestionUsuarios />} />
          <Route path="contratipos"      element={<Contratipos />} />
        </Route>

        {/* Producción */}
        <Route path="/produccion" element={
          <RutaProtegida roles={['produccion']}>
            <ProduccionLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="producir" replace />} />
          <Route path="ordenes"       element={<OrdenesProduccion />} />
          <Route path="producir"      element={<RegistrarProduccion />} />
          <Route path="planificacion" element={<Planificacion />} />
          <Route path="calendario"    element={<CalendarioProduccion />} />
          <Route path="stock"         element={<StockVendedor />} />
          <Route path="expo"          element={<AprobarExpo />} />
        </Route>

        {/* Finanzas */}
        <Route path="/finanzas" element={
          <RutaProtegida roles={['finanzas']}>
            <FinanzasLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="facturar" replace />} />
          <Route path="facturar"      element={<OrdenesFacturar />} />
          <Route path="emitidas"      element={<FacturasEmitidas />} />
          <Route path="notas"         element={<NotasCreditoDebito />} />
          <Route path="estado-cuenta" element={<EstadoCuenta />} />
          <Route path="historico"     element={<HistoricoCompras />} />
          <Route path="directorio"    element={<DirectorioClientes />} />
        </Route>

        {/* Logística */}
        <Route path="/logistica" element={
          <RutaProtegida roles={['logistica']}>
            <LogisticaLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="mapa" replace />} />
          <Route path="mapa"      element={<MapaEntregas />} />
          <Route path="plan"      element={<PlanDiario />} />
          <Route path="recepcion" element={<RecepcionMercaderia />} />
          <Route path="zonas"          element={<ZonasEntrega />} />
          <Route path="transportistas"  element={<Transportistas />} />
          <Route path="cronograma"      element={<CronogramaEnvios />} />
        </Route>

        {/* Chofer */}
        <Route path="/chofer" element={
          <RutaProtegida roles={['chofer']}>
            <ChoferLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="entregas" replace />} />
          <Route path="entregas" element={<EntregasChofer />} />
          <Route path="mapa"     element={<MapaChofer />} />
        </Route>

{/* COMEX */}
        <Route path="/comex" element={
          <RutaProtegida roles={['comex']}>
            <ComexLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="solicitudes" replace />} />
          <Route path="solicitudes" element={<SolicitudesComex />} />
        </Route>

        {/* Depósito */}
        <Route path="/deposito" element={
          <RutaProtegida roles={['deposito']}>
            <DepositoLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="cronograma" replace />} />
          <Route path="cronograma" element={<CronogramaDeposito />} />
        </Route>

        {/* Laboratorio */}
        <Route path="/laboratorio" element={
          <RutaProtegida roles={['laboratorio']}>
            <LaboratorioLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="coas" replace />} />
          <Route path="coas"        element={<CoasLaboratorio />} />
          <Route path="documentos"  element={<DocumentosLaboratorio />} />
          <Route path="muestras"    element={<MuestrasLaboratorio />} />
          <Route path="contratipos" element={<ContratiposLaboratorio />} />
          <Route path="desarrollos" element={<DesarrollosLaboratorio />} />
        </Route>

        {/* Asistente de ventas */}
        <Route path="/asistente" element={
          <RutaProtegida roles={['asistente_ventas']}>
            <AsistenteLayout />
          </RutaProtegida>
        }>
          <Route index element={<Navigate to="ordenes" replace />} />
          <Route path="ordenes"    element={<OrdenesAsistente />} />
          <Route path="historico"  element={<HistoricoCompras />} />
          <Route path="directorio" element={<DirectorioClientes />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
