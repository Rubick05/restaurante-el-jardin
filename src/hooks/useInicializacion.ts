/**
 * useInicializacion.ts
 *
 * Hook que se ejecuta al abrir la app y sincroniza TODOS los datos
 * del servidor hacia IndexedDB local. Así cualquier dispositivo o navegador
 * que acceda a la URL de Railway verá los mismos datos.
 *
 * El servidor se detecta automáticamente usando window.location.origin
 * cuando estamos en producción (Railway). En desarrollo usa localhost:3000.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';

/** Obtiene la URL base del servidor de forma inteligente en runtime */
function getApiUrl(): string {
    // 1. Variable de entorno del build (si fue configurada antes del build)
    const buildEnv = import.meta.env.VITE_API_URL;
    if (buildEnv && buildEnv.length > 0) return buildEnv;

    // 2. En producción: el servidor sirve el frontend, misma URL base
    if (import.meta.env.PROD) {
        return window.location.origin;
    }

    // 3. Desarrollo local
    return 'http://localhost:3001';
}

export const API_BASE_URL = getApiUrl();

/**
 * Sincroniza datos del servidor → IndexedDB.
 * Se ejecuta al montar la app y cada 30 segundos.
 */
/** Normaliza campos numéricos del menú que PostgreSQL devuelve como strings */
export function normalizarMenu(items: any[]): any[] {
    return items.map(i => ({
        ...i,
        precio_actual: Number(i.precio_actual ?? 0),
        costo: Number(i.costo ?? 0),
        disponible: Boolean(i.disponible),
    }));
}

/** Formatea una fecha o string ISO a YYYY-MM-DD en zona horaria local, respetando strings ya formateados */
export function formatearFechaLocal(dateInput?: string | Date): string {
    if (!dateInput) return '';
    try {
        if (typeof dateInput === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                return dateInput;
            }
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return '';
            const anio = d.getFullYear();
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            return `${anio}-${mes}-${dia}`;
        } else if (dateInput instanceof Date) {
            if (isNaN(dateInput.getTime())) return '';
            const anio = dateInput.getFullYear();
            const mes = String(dateInput.getMonth() + 1).padStart(2, '0');
            const dia = String(dateInput.getDate()).padStart(2, '0');
            return `${anio}-${mes}-${dia}`;
        }
    } catch (e) {
        console.error('Error al formatear fecha local:', e);
    }
    return '';
}

/** Normaliza campos numéricos de pedidos que PostgreSQL devuelve como strings */
export function normalizarPedidos(pedidos: any[]): any[] {
    return pedidos.map(p => ({
        ...p,
        total: Number(p.total ?? 0),
        subtotal: Number(p.subtotal ?? 0),
        impuesto: Number(p.impuesto ?? 0),
        numero_ficha: Number(p.numero_ficha ?? 0),
        version: Number(p.version ?? 1),
        items: (p.items ?? []).map((it: any) => ({
            ...it,
            cantidad: Number(it.cantidad ?? 1),
            precio_unitario: Number(it.precio_unitario ?? 0),
        })),
        sincronizado: true,
    }));
}


export function useInicializacion() {
    const queryClient = useQueryClient();
    const sincronizandoRef = useRef(false);

    const sincronizar = async () => {
        if (sincronizandoRef.current) return;
        sincronizandoRef.current = true;

        try {
            const base = API_BASE_URL;

            // ── 1. Sincronizar menú ──────────────────────────────────────────
            const resMenu = await fetch(`${base}/api/menu`, {
                signal: AbortSignal.timeout(8000)
            });
            if (resMenu.ok) {
                const items = normalizarMenu(await resMenu.json());
                await bdLocal.elementosMenu.bulkPut(items);
                queryClient.invalidateQueries({ queryKey: ['menu'] });
            }

            // ── 2. Sincronizar pedidos activos + pedidos de hoy ───────────────────────────────
            const [resPedidosActivos, resPedidosHoy] = await Promise.all([
                fetch(`${base}/api/pedidos`, { signal: AbortSignal.timeout(8000) }).catch(() => null),
                fetch(`${base}/api/pedidos?hoy=true`, { signal: AbortSignal.timeout(8000) }).catch(() => null)
            ]);

            if ((resPedidosActivos && resPedidosActivos.ok) || (resPedidosHoy && resPedidosHoy.ok)) {
                const arrActivos = resPedidosActivos && resPedidosActivos.ok ? await resPedidosActivos.json() : [];
                const arrHoy = resPedidosHoy && resPedidosHoy.ok ? await resPedidosHoy.json() : [];

                // Combinar y normalizar
                const combinados = normalizarPedidos([...arrActivos, ...arrHoy]);

                // Deduplicar por ID de pedido
                const mapPedidos = new Map<string, any>();
                combinados.forEach(p => {
                    mapPedidos.set(p.id, p);
                });
                const pedidosUnicos = Array.from(mapPedidos.values());

                // Detectar pedidos que el servidor ya eliminó para borrarlos localmente
                const idsServidor = new Set(pedidosUnicos.map((p: any) => p.id));
                const locales = await bdLocal.pedidos.toArray();
                
                // Conservar hoy los pedidos cobrados locales para reportes/ventas
                const hoyStr = formatearFechaLocal(new Date());
                const aBorrar = locales
                    .filter(p => {
                        const noEnServidor = !idsServidor.has(p.id);
                        if (noEnServidor && p.sincronizado === true) {
                            const esFinalizado = p.estado === 'pagado' || p.estado === 'cancelado';
                            const esDeHoy = p.creado_en && formatearFechaLocal(p.creado_en) === hoyStr;
                            if (esFinalizado && esDeHoy) {
                                return false; // No borrar, conservar hoy
                            }
                            return true; // Borrar
                        }
                        return false;
                    })
                    .map(p => p.id);

                if (aBorrar.length > 0) {
                    await bdLocal.pedidos.bulkDelete(aBorrar);
                }

                await bdLocal.pedidos.bulkPut(pedidosUnicos);
                queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
                queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
                queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
            }

            // ── 3. Sincronizar Historial de Días Cerrados ────────────────────
            const resHistorial = await fetch(`${base}/api/historial`, {
                signal: AbortSignal.timeout(8000)
            });
            if (resHistorial.ok) {
                const diasHistorial = await resHistorial.json();

                // Formatear si es necesario (el backend envía snake_case alineado con dbLocal)
                const diasNormalizados = diasHistorial.map((d: any) => ({
                    id: d.id,
                    fecha: d.fecha,
                    total_recaudado: Number(d.total_recaudado ?? 0),
                    total_pedidos: Number(d.total_pedidos ?? 0),
                    total_items: Number(d.total_items ?? 0),
                    pedidos_snapshot: typeof d.pedidos_snapshot === 'string' ? d.pedidos_snapshot : JSON.stringify(d.pedidos_snapshot),
                    cerrado_en: d.cerrado_en
                }));

                await bdLocal.diasCerrados.bulkPut(diasNormalizados);
                queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
            }

            // ── 4. Sincronizar Gastos ────────────────────────────────────────
            const resGastos = await fetch(`${base}/api/gastos`, {
                signal: AbortSignal.timeout(8000)
            });
            if (resGastos.ok) {
                const gastosServidor = await resGastos.json();
                const gastosNormalizados = gastosServidor.map((g: any) => ({
                    id: g.id,
                    id_restaurante: g.id_restaurante,
                    descripcion: g.descripcion,
                    monto: Number(g.monto ?? 0),
                    categoria: g.categoria,
                    fecha: g.fecha ? formatearFechaLocal(g.fecha) : formatearFechaLocal(new Date()),
                    creado_en: g.creado_en,
                    actualizado_en: g.actualizado_en
                }));

                // Borrar locales que no están en el servidor
                const idsServidor = new Set(gastosNormalizados.map((g: any) => g.id));
                const locales = await bdLocal.gastos.toArray();
                const aBorrar = locales
                    .filter(g => !idsServidor.has(g.id))
                    .map(g => g.id);

                if (aBorrar.length > 0) {
                    await bdLocal.gastos.bulkDelete(aBorrar);
                }

                await bdLocal.gastos.bulkPut(gastosNormalizados);
                queryClient.invalidateQueries({ queryKey: ['gastos'] });
            }

        } catch (err) {
            console.warn('Sincronización inicial falló (modo offline):', err);
        } finally {
            sincronizandoRef.current = false;
        }
    };

    useEffect(() => {
        // Sincronizar inmediatamente al abrir la app
        sincronizar();

        // Re-sincronizar cada 30 segundos
        const intervalo = setInterval(sincronizar, 30_000);

        // También sincronizar al volver a la pestaña / reconectar red
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') sincronizar();
        };
        const handleOnline = () => sincronizar();

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(intervalo);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };
    }, []);
}
