/**
 * api-servidor.ts
 *
 * Capa de comunicación con el servidor REST (Railway).
 * TODOS los componentes del frontend deben usar estas funciones
 * en lugar de manipular bdLocal directamente cuando el servidor está disponible.
 *
 * Si VITE_API_URL no está definida, funciona en modo offline (solo IndexedDB).
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** true si tenemos servidor configurado */
export const servidorDisponible = (): boolean => !!BASE_URL;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ══════════════════════ PEDIDOS ══════════════════════

/** Obtener pedidos activos del servidor */
export async function obtenerPedidosActivos() {
    return apiFetch<any[]>('/api/pedidos');
}

/** Obtener todos los pedidos de hoy */
export async function obtenerPedidosHoy() {
    return apiFetch<any[]>('/api/pedidos/hoy');
}

/** Crear nuevo pedido en el servidor */
export async function crearPedidoServidor(pedido: any) {
    return apiFetch<{ ok: boolean; pedido: any }>('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(pedido),
    });
}

/** Actualizar estado del pedido en el servidor */
export async function actualizarEstadoPedido(
    id: string,
    cambios: { estado?: string; datos_facturacion?: any; item_id?: string; estado_item?: string }
) {
    return apiFetch<{ ok: boolean; pedido?: any; item?: any }>(
        `/api/pedidos/${id}`,
        { method: 'PATCH', body: JSON.stringify(cambios) }
    );
}

/** Cerrar el día — guarda snapshot y marca pedidos como pagados */
export async function cerrarDiaServidor() {
    return apiFetch<{ ok: boolean; fecha: string; total_recaudado: number; total_pedidos: number }>(
        '/api/pedidos/cerrar-dia',
        { method: 'POST' }
    );
}

// ══════════════════════ MENÚ ══════════════════════

/** Obtener menú del servidor */
export async function obtenerMenuServidor() {
    return apiFetch<any[]>('/api/menu');
}

/** Guardar/actualizar elemento del menú en servidor */
export async function guardarElementoMenuServidor(elemento: any) {
    return apiFetch<any>('/api/menu', {
        method: 'POST',
        body: JSON.stringify(elemento),
    });
}

/** Actualizar campo(s) de un elemento del menú */
export async function actualizarElementoMenu(id: string, cambios: Record<string, any>) {
    return apiFetch<any>(`/api/menu/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
    });
}

/** Eliminar elemento del menú */
export async function eliminarElementoMenuServidor(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/menu/${id}`, { method: 'DELETE' });
}

// ══════════════════════ HISTORIAL DÍAS ══════════════════════

/** Obtener historial de días cerrados */
export async function obtenerHistorialDias() {
    return apiFetch<any[]>('/api/historial');
}

/** Eliminar un día del historial */
export async function eliminarDiaHistorial(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/historial/${id}`, { method: 'DELETE' });
}
