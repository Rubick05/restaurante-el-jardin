-- ================================================================================
-- Sistema de Gestión de Restaurantes - Esquema PostgreSQL
-- Arquitectura Multi-Tenant con Particionamiento de Tablas y Seguridad a Nivel de Fila (RLS)
-- ================================================================================

-- Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================================
-- RESTAURANTES (Tenants)
-- ================================================================================

CREATE TABLE restaurantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    subdominio VARCHAR(100) UNIQUE NOT NULL,
    zona_horaria VARCHAR(50) DEFAULT 'UTC',
    moneda VARCHAR(3) DEFAULT 'USD',
    configuracion JSONB DEFAULT '{}',
    estado_suscripcion VARCHAR(20) DEFAULT 'activo',
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restaurantes_subdominio ON restaurantes(subdominio);

-- ================================================================================
-- USUARIOS (Personal - Integrado con Clerk)
-- ================================================================================

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    id_usuario_clerk VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'mesero', 'cocina')),
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_restaurante ON usuarios(id_restaurante);
CREATE INDEX idx_usuarios_clerk ON usuarios(id_usuario_clerk);

-- Seguridad a Nivel de Fila (RLS) para usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_usuarios ON usuarios
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- ================================================================================
-- ELEMENTOS DEL MENÚ con Versionado de Precios
-- ================================================================================

CREATE TABLE elementos_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100) NOT NULL,
    url_imagen TEXT,
    precio_actual DECIMAL(10, 2) NOT NULL,
    disponible BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_elementos_menu_restaurante ON elementos_menu(id_restaurante);
CREATE INDEX idx_elementos_menu_categoria ON elementos_menu(id_restaurante, categoria);

-- Historial de precios para reportes históricos precisos
CREATE TABLE precios_elementos_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_elemento_menu UUID NOT NULL REFERENCES elementos_menu(id) ON DELETE CASCADE,
    id_restaurante UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    precio DECIMAL(10, 2) NOT NULL,
    vigente_desde TIMESTAMPTZ DEFAULT NOW(),
    vigente_hasta TIMESTAMPTZ,
    creado_por UUID REFERENCES usuarios(id)
);

CREATE INDEX idx_precios_elemento ON precios_elementos_menu(id_elemento_menu);
CREATE INDEX idx_precios_restaurante ON precios_elementos_menu(id_restaurante);
CREATE INDEX idx_precios_vigencia ON precios_elementos_menu(vigente_desde, vigente_hasta);

-- Seguridad a Nivel de Fila
ALTER TABLE elementos_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_elementos_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_elementos_menu ON elementos_menu
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

CREATE POLICY aislamiento_restaurante_precios_menu ON precios_elementos_menu
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- ================================================================================
-- MESAS / ZONAS
-- ================================================================================

CREATE TABLE mesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    numero_mesa VARCHAR(50) NOT NULL,
    zona VARCHAR(100),
    capacidad INTEGER DEFAULT 4,
    estado VARCHAR(20) DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupada', 'reservada', 'mantenimiento')),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id_restaurante, numero_mesa)
);

CREATE INDEX idx_mesas_restaurante ON mesas(id_restaurante);

ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_mesas ON mesas
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- ================================================================================
-- PEDIDOS - PARTICIONADOS POR ID_RESTAURANTE
-- ================================================================================

-- Crear tabla padre
CREATE TABLE pedidos (
    id UUID DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL,
    id_mesa UUID REFERENCES mesas(id),
    id_mesero UUID REFERENCES usuarios(id),
    numero_pedido VARCHAR(50) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' 
        CHECK (estado IN ('pendiente', 'confirmado', 'en_proceso', 'listo', 'entregado', 'pagado', 'cancelado')),
    tipo_pedido VARCHAR(20) DEFAULT 'mesa' 
        CHECK (tipo_pedido IN ('mesa', 'llevar', 'delivery')),
    subtotal DECIMAL(10, 2) DEFAULT 0,
    impuesto DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    notas TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1, -- Para resolución de conflictos
    sincronizado BOOLEAN DEFAULT false, -- Para rastreo de sync offline
    PRIMARY KEY (id, id_restaurante)
) PARTITION BY LIST (id_restaurante);

CREATE INDEX idx_pedidos_restaurante ON pedidos(id_restaurante);
CREATE INDEX idx_pedidos_estado ON pedidos(id_restaurante, estado);
CREATE INDEX idx_pedidos_creado ON pedidos(id_restaurante, creado_en DESC);
CREATE INDEX idx_pedidos_sync ON pedidos(id_restaurante, sincronizado) WHERE sincronizado = false;

-- Seguridad a Nivel de Fila
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_pedidos ON pedidos
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- Partición por defecto para nuevos restaurantes
CREATE TABLE pedidos_default PARTITION OF pedidos DEFAULT;

-- ================================================================================
-- ITEMS DEL PEDIDO - PARTICIONADOS POR ID_RESTAURANTE
-- ================================================================================

CREATE TABLE items_pedido (
    id UUID DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL,
    id_pedido UUID NOT NULL,
    id_elemento_menu UUID REFERENCES elementos_menu(id),
    nombre_item VARCHAR(255) NOT NULL, -- Desnormalizado para precisión histórica
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10, 2) NOT NULL, -- Precio al momento del pedido
    subtotal DECIMAL(10, 2) NOT NULL,
    instrucciones_especiales TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, id_restaurante),
    FOREIGN KEY (id_pedido, id_restaurante) REFERENCES pedidos(id, id_restaurante) ON DELETE CASCADE
) PARTITION BY LIST (id_restaurante);

CREATE INDEX idx_items_pedido_pedido ON items_pedido(id_restaurante, id_pedido);

ALTER TABLE items_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_items_pedido ON items_pedido
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- Partición por defecto
CREATE TABLE items_pedido_default PARTITION OF items_pedido DEFAULT;

-- ================================================================================
-- COLA DE SINCRONIZACIÓN - Para Resolución de Conflictos y Auditoría
-- ================================================================================

CREATE TABLE cola_sincronizacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    tipo_entidad VARCHAR(50) NOT NULL, -- 'pedido', 'item_pedido', etc.
    id_entidad UUID NOT NULL,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('crear', 'actualizar', 'eliminar')),
    carga_util JSONB NOT NULL, -- payload
    timestamp_cliente TIMESTAMPTZ NOT NULL,
    timestamp_servidor TIMESTAMPTZ DEFAULT NOW(),
    conflicto_detectado BOOLEAN DEFAULT false,
    resolucion_conflicto VARCHAR(50), -- 'ultima_escritura_gana', 'manual', etc.
    procesado BOOLEAN DEFAULT false,
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cola_sincronizacion_restaurante ON cola_sincronizacion(id_restaurante);
CREATE INDEX idx_cola_sincronizacion_procesado ON cola_sincronizacion(procesado) WHERE procesado = false;
CREATE INDEX idx_cola_sincronizacion_entidad ON cola_sincronizacion(tipo_entidad, id_entidad);

ALTER TABLE cola_sincronizacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_cola_sinc ON cola_sincronizacion
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- ================================================================================
-- REGISTRO DE ACTIVIDAD - Auditoría
-- ================================================================================

CREATE TABLE registro_actividad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    id_usuario UUID REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    tipo_entidad VARCHAR(50),
    id_entidad UUID,
    metadatos JSONB,
    direccion_ip INET,
    agente_usuario TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_registro_actividad_restaurante ON registro_actividad(id_restaurante, creado_en DESC);
CREATE INDEX idx_registro_actividad_usuario ON registro_actividad(id_usuario, creado_en DESC);

ALTER TABLE registro_actividad ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_restaurante_registro_actividad ON registro_actividad
    USING (id_restaurante = current_setting('app.restaurante_actual', true)::UUID);

-- ================================================================================
-- FUNCIONES Y DISPARADORES (TRIGGERS)
-- ================================================================================

-- Función para actualizar columna actualizado_en
CREATE OR REPLACE FUNCTION actualizar_columna_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de actualización a tablas relevantes
CREATE TRIGGER actualizar_restaurantes_actualizado_en BEFORE UPDATE ON restaurantes
    FOR EACH ROW EXECUTE FUNCTION actualizar_columna_actualizado_en();

CREATE TRIGGER actualizar_usuarios_actualizado_en BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_columna_actualizado_en();

CREATE TRIGGER actualizar_elementos_menu_actualizado_en BEFORE UPDATE ON elementos_menu
    FOR EACH ROW EXECUTE FUNCTION actualizar_columna_actualizado_en();

CREATE TRIGGER actualizar_mesas_actualizado_en BEFORE UPDATE ON mesas
    FOR EACH ROW EXECUTE FUNCTION actualizar_columna_actualizado_en();

CREATE TRIGGER actualizar_pedidos_actualizado_en BEFORE UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION actualizar_columna_actualizado_en();

-- Función para crear historial de precios cuando cambia el precio del menú
CREATE OR REPLACE FUNCTION rastrear_cambio_precio_menu()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.precio_actual != OLD.precio_actual THEN
        -- Cerrar el registro de precio anterior
        UPDATE precios_elementos_menu 
        SET vigente_hasta = NOW()
        WHERE id_elemento_menu = OLD.id 
          AND vigente_hasta IS NULL;
        
        -- Crear nuevo registro de precio
        INSERT INTO precios_elementos_menu (
            id_elemento_menu,
            id_restaurante,
            precio,
            vigente_desde
        ) VALUES (
            NEW.id,
            NEW.id_restaurante,
            NEW.precio_actual,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rastrear_cambios_precios_menu 
    AFTER UPDATE ON elementos_menu
    FOR EACH ROW 
    EXECUTE FUNCTION rastrear_cambio_precio_menu();

-- Función para crear particiones automáticamente para nuevos restaurantes
CREATE OR REPLACE FUNCTION crear_particiones_restaurante()
RETURNS TRIGGER AS $$
DECLARE
    nombre_particion TEXT;
BEGIN
    -- Crear partición de pedidos
    nombre_particion := 'pedidos_' || replace(NEW.id::TEXT, '-', '_');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF pedidos FOR VALUES IN (%L)', 
                   nombre_particion, NEW.id);
    
    -- Crear partición de items_pedido
    nombre_particion := 'items_pedido_' || replace(NEW.id::TEXT, '-', '_');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF items_pedido FOR VALUES IN (%L)', 
                   nombre_particion, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crear_particiones_al_insertar_restaurante
    AFTER INSERT ON restaurantes
    FOR EACH ROW
    EXECUTE FUNCTION crear_particiones_restaurante();

-- ================================================================================
-- VISTAS - Reportes conscientes de la zona horaria
-- ================================================================================

CREATE OR REPLACE VIEW pedidos_con_zona_horaria AS
SELECT 
    p.*,
    r.zona_horaria,
    p.creado_en AT TIME ZONE r.zona_horaria AS creado_en_local,
    p.actualizado_en AT TIME ZONE r.zona_horaria AS actualizado_en_local
FROM pedidos p
JOIN restaurantes r ON p.id_restaurante = r.id;

-- ================================================================================
-- FUNCIONES AUXILIARES
-- ================================================================================

-- Función para obtener precio de item de menú en una fecha específica (para reportes históricos)
CREATE OR REPLACE FUNCTION obtener_precio_item_en_fecha(
    p_id_elemento_menu UUID,
    p_fecha TIMESTAMPTZ
)
RETURNS DECIMAL AS $$
DECLARE
    v_precio DECIMAL(10, 2);
BEGIN
    SELECT precio INTO v_precio
    FROM precios_elementos_menu
    WHERE id_elemento_menu = p_id_elemento_menu
      AND vigente_desde <= p_fecha
      AND (vigente_hasta IS NULL OR vigente_hasta > p_fecha)
    ORDER BY vigente_desde DESC
    LIMIT 1;
    
    RETURN v_precio;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- DATOS DE EJEMPLO (para pruebas - eliminar en producción)
-- ================================================================================

-- Insertar restaurante de ejemplo
INSERT INTO restaurantes (id, nombre, subdominio, zona_horaria, moneda)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Restaurante Pelusa', 'pelusa', 'America/La_Paz', 'BOB');

-- El trigger creará automáticamente las particiones para este restaurante

COMMENT ON TABLE pedidos IS 'Tabla de pedidos particionada por id_restaurante para aislamiento de rendimiento';
COMMENT ON TABLE cola_sincronizacion IS 'Rastrea operaciones offline y resolución de conflictos';
COMMENT ON VIEW pedidos_con_zona_horaria IS 'Pedidos con marcas de tiempo ajustadas a la zona horaria del restaurante';
