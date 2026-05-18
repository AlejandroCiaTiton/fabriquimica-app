CREATE TABLE IF NOT EXISTS transportistas (
  id bigserial PRIMARY KEY,
  nombre text NOT NULL,
  apellido text NOT NULL,
  empresa text,
  vehiculo text,
  activo boolean DEFAULT true,
  creado_en timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cronograma_envios (
  id bigserial PRIMARY KEY,
  oc_id bigint REFERENCES ordenes_compra(id),
  transportista_id bigint REFERENCES transportistas(id),
  fecha_programada date NOT NULL,
  hora_estimada time,
  observaciones text,
  estado text DEFAULT 'programado' CHECK (estado IN ('programado','en-camino','entregado','sin-productos','sin-transporte')),
  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coas (
  id bigserial PRIMARY KEY,
  trabajo_id bigint REFERENCES trabajos_produccion(id),
  numero_lote text,
  archivo_url text NOT NULL,
  subido_por uuid REFERENCES auth.users(id),
  creado_en timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS muestras (
  id bigserial PRIMARY KEY,
  cliente_id bigint REFERENCES clientes(id),
  producto_id bigint REFERENCES productos(id),
  producto_nombre text,
  fecha_envio date NOT NULL,
  cantidad_g numeric,
  numero_lote text,
  resultado text CHECK (resultado IN ('pendiente','aprobado','rechazado','sin-respuesta')),
  devolucion text,
  notas text,
  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS desarrollos (
  id bigserial PRIMARY KEY,
  codigo text UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  productos_utilizados jsonb DEFAULT '[]',
  resultado_esperado text,
  resultado_obtenido text,
  estado text DEFAULT 'en-curso' CHECK (estado IN ('en-curso','exitoso','descartado','pausado')),
  fecha_inicio date,
  fecha_fin date,
  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz DEFAULT now()
);

ALTER TYPE oc_estado ADD VALUE IF NOT EXISTS 'pendiente-despacho' AFTER 'listo-entrega';

-- Nuevos tipos de usuario en el enum user_tipo
ALTER TYPE user_tipo ADD VALUE IF NOT EXISTS 'deposito';
ALTER TYPE user_tipo ADD VALUE IF NOT EXISTS 'laboratorio';
