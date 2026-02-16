# MVP Sistema de Gestión de Restaurantes - Plan de Implementación

Una plataforma SaaS escalable y "offline-first" para la operación de restaurantes con multi-tenencia, sincronización en tiempo real e integración nativa de hardware.

## Cambios Propuestos

### Estructura Principal del Proyecto

#### [NUEVO] package.json

Proyecto React + TypeScript + Vite con:
- React 18 + TypeScript
- TanStack Query para gestión de datos
- Capacitor para características PWA/nativas
- Clerk para autenticación
- Socket.io-client para actualizaciones en tiempo real
- Tailwind CSS para estilos
- Recharts para analíticas
- date-fns para manejo de zonas horarias

#### [NUEVO] capacitor.config.ts

Configuración de Capacitor habilitando:
- API Web Bluetooth para impresoras térmicas
- Persistencia offline
- Compatibilidad multiplataforma

---

### Esquema de Base de Datos y Multi-Tenencia

#### [NUEVO] database/esquema.sql

**Arquitectura Multi-Tenant:**
- **Tablas particionadas** por `id_restaurante` (tenant_id)
- **Políticas de Seguridad a Nivel de Fila (RLS)** en todos los datos del inquilino
- **Versionado de precios** para mantener precisión histórica
- **Almacenamiento de zona horaria** en UTC con configuración por inquilino

**Tablas clave:**
- `restaurantes` - Cuentas de restaurantes (tenants)
- `usuarios` - Cuentas de personal con acceso basado en roles
- `elementos_menu` - Productos con historial de precios
- `pedidos` - Pedidos de clientes (particionados por restaurante)
- `items_pedido` - Líneas de pedido
- `mesas` - Gestión de mesas/zonas
- `cola_sincronizacion` - Resolución de conflictos y auditoría

---

### Aplicación Frontend

#### [NUEVO] src/lib/bd/

**Capa de base de datos local** usando IndexedDB con Dexie.js:
- `bd-local.ts` - Esquema IndexedDB y operaciones
- `motor-sincronizacion.ts` - Cola de sincronización y resolución de conflictos
- `gestor-offline.ts` - Detección de estado de red y manejo de modo offline

#### [NUEVO] src/lib/api/

**Capa cliente API:**
- `cliente.ts` - Cliente HTTP con inyección de contexto de restaurante
- `pedidos.ts` - Operaciones CRUD de pedidos con actualizaciones optimistas
- `menu.ts` - Obtención y caché de elementos del menú
- `sincronizacion.ts` - Gestión de conexión WebSocket

#### [NUEVO] src/hooks/

**Hooks personalizados de React:**
- `useSincronizacionOffline.ts` - Gestión de cola offline
- `usePedidosTiempoReal.ts` - Suscripción WebSocket para actualizaciones de cocina
- `useContextoRestaurante.ts` - Contexto del restaurante actual
- `useImpresora.ts` - Integración con impresora térmica Bluetooth

---

### Componentes de Funcionalidad

#### Módulo Mesero / POS

##### [NUEVO] src/componentes/mesero/NavegadorMenu.tsx
- Navegación de menú por categorías
- Estado de disponibilidad en tiempo real (items agotados en gris)
- Búsqueda instantánea y filtrado usando TanStack Query

##### [NUEVO] src/componentes/mesero/CreacionPedido.tsx
- **UI Optimista**: El pedido aparece inmediatamente en el estado local
- Interfaz táctil amigable para tablet/celular
- Integración con cola offline
- Botón de impresión Bluetooth

##### [NUEVO] src/componentes/mesero/MapaMesas.tsx
- Estado visual de mesas (disponible, ocupada, requiere atención)
- Arrastrar para asignar pedidos

---

#### Sistema de Pantalla de Cocina (KDS)

##### [NUEVO] src/componentes/cocina/TableroKanban.tsx
- **Columnas en tiempo real**: Nuevo → En Proceso → Listo → Entregado
- Actualizaciones instantáneas vía WebSocket
- Prioridad por colores (antigüedad del pedido)
- Temporizador por pedido

##### [NUEVO] src/componentes/cocina/ControlInventario.tsx
- Botón "Agotado" (86) para marcar items sin stock
- Difusión a todos los meseros conectados vía WebSocket
- Auto-restauración en tiempo configurado (ej. día siguiente)

---

#### Panel de Administración

##### [NUEVO] src/componentes/admin/GestionMenu.tsx
- CRUD para elementos del menú
- El cambio de precio crea una nueva versión, la versión anterior se archiva
- Consultas de precios históricos para reportes precisos

##### [NUEVO] src/componentes/admin/ReportesVentas.tsx
- Filtros de fecha conscientes de la zona horaria (usando la zona configurada del restaurante)
- Gráficos de ingresos con Recharts
- Exportación a CSV/PDF

##### [NUEVO] src/componentes/admin/GestionPersonal.tsx
- Integración con Clerk para creación de usuarios
- Asignación de roles (Admin, Mesero, Cocina)
- Registros de actividad

---

### Servidor Backend (Railway)

#### [NUEVO] server/src/index.ts

**Servidor Express + Socket.io:**
- Endpoints API RESTful
- Servidor WebSocket para actualizaciones en tiempo real
- Middleware de contexto de restaurante (establece `app.current_tenant` para RLS)
- Pool de conexiones para PostgreSQL

**Endpoints clave:**
- `POST /api/pedidos` - Crear pedido (con detección de conflictos)
- `GET /api/pedidos` - Listar pedidos (filtrados por restaurante)
- `PATCH /api/pedidos/:id` - Actualizar estado
- `POST /api/sincronizar` - Sincronización por lotes de cola offline
- `POST /api/menu/:id/agotado` - Marcar item como no disponible

#### [NUEVO] server/src/sincronizacion/

**Motor de sincronización:**
- `resolutor-conflictos.ts` - "Última escritura gana" con seguimiento de versiones
- `procesador-cola.ts` - Procesa colas de escritura offline
- `emisor-tiempo-real.ts` - Emite eventos WebSocket en cambios de datos

---

### Configuración PWA

#### [NUEVO] public/manifest.json

Manifiesto PWA con:
- Nombre de app, iconos, colores de tema
- `display: standalone` para experiencia tipo app
- Preferencias de orientación

#### [NUEVO] src/sw.ts

**Service Worker:**
- Estrategia Cache-first para recursos estáticos
- Network-first para llamadas API
- Página de fallback offline
- Sincronización en segundo plano para peticiones en cola

---

### Despliegue

#### [NUEVO] Dockerfile

**Construcción multi-etapa:**
1. Construir frontend (React/Vite)
2. Construir backend (Node.js/TypeScript)
3. Imagen de producción con Nginx + Node.js

#### [NUEVO] railway.json

Configuración Railway:
- Servicio PostgreSQL con respaldos automáticos
- Comandos de construcción y arranque
- Plantillas de variables de entorno
- Conexiones WebSocket persistentes habilitadas
