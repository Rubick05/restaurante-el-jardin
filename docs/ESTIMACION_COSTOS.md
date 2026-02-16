# Estimación de Costos Operativos - Restaurante Pelusa (Alto Tráfico)

Este documento detalla los costos mensuales estimados para mantener el sistema SaaS en producción en la plataforma **Railway**, ajustado para un restaurante con alto volumen de transacciones y personal.

## Resumen Ejecutivo

| Servicio                      | Plan Recomendado | Costo Mensual Estimado (USD) | Notas                                         |
| :---------------------------- | :--------------- | :--------------------------- | :-------------------------------------------- |
| **Infraestructura (Railway)** | Pro Plan         | $20.00 - $40.00              | Cubre Base de Datos y Servidor Backend        |
| **Autenticación (Clerk)**     | Free Tier        | $0.00                        | Gratis hasta 5,000 usuarios activos mensuales |
| **Dominio (Namecheap/etc)**   | Anual            | ~$1.00 ($12/año)             | Costo prorrateado                             |
| **Total Mensual**             |                  | **$21.00 - $41.00 USD**      | Margen de seguridad incluido                  |

---

## Desglose Detallado (Infraestructura Railway)

Railway cobra por uso de recursos (RAM/CPU) y almacenamiento. Para un escenario de "Alto Tráfico" (muchos pedidos simultáneos, WebSockets activos todo el día):

### 1. Base de Datos (PostgreSQL)
El componente más crítico. Necesita memoria suficiente para manejar consultas rápidas de múltiples meseros y cocina simultáneamente.

*   **Configuración Sugerida:** 1 GB RAM / 1 vCPU
*   **Almacenamiento:** 10 GB (Suficiente para millones de pedidos de texto)
*   **Costo Estimado:** ~$15.00 USD/mes

### 2. Backend (Node.js + WebSockets)
Mantiene las conexiones en tiempo real. Node.js es eficiente, pero los WebSockets consumen RAM por cada conexión abierta.

*   **Configuración Sugerida:** 512 MB RAM / 0.5 vCPU
*   **Costo Estimado:** ~$8.00 USD/mes

### 3. Plan de Suscripción Railway "Pro"
*   **Costo Fijo:** $20.00 USD/mes
*   **Beneficio:** Este pago incluye **$20 USD de crédito de uso**.
*   **Cálculo Final:**
    *   Uso Total ($15 DB + $8 Backend) = $23.00
    *   Crédito Incluido = -$20.00
    *   Excedente a Pagar = $3.00
    *   **Total a Facturar:** $20 (Base) + $3 (Excedente) = **$23.00 USD**

> **Nota:** Se ha estimado un rango superior de hasta $40 USD en el resumen para cubrir picos de demanda estacionales o ineficiencias iniciales de código, garantizando que el presupuesto no se quede corto.

---

## Otros Servicios

### Clerk (Gestión de Usuarios)
*   **Uso:** Autenticación de Meseros, Cocineros y Administradores.
*   **Límite Gratuito:** 5,000 MAUs (Usuarios Activos Mensuales).
*   **Escenario Pelusa:** Incluso con 50 empleados entrando a diario, estamos muy por debajo del límite.
*   **Costo:** **$0.00 USD**

### Capacitor (App Móvil)
*   La compilación es local. No requiere servicios en la nube pagados para distribuir el APK internamente (Sideloading).
*   **Costo:** **$0.00 USD**

---

## Recomendación al Cliente

Se sugiere presupuestar una **tarifa plana de mantenimiento de $50.00 USD/mes**.
*   Cubre los ~$25 USD de infraestructura real.
*   Deja ~$25 USD puramente operativos para el fondo de imprevistos o margen de ganancia del desarrollador por gestión del servicio.
