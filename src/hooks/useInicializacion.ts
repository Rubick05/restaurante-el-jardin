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
    return 'http://localhost:3000';
}

export const API_BASE_URL = getApiUrl();

/**
 * Sincroniza datos del servidor → IndexedDB.
 * Se ejecuta al montar la app y cada 30 segundos.
 */
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
                const items = await resMenu.json();
                // Guardar todos en IndexedDB (put hace upsert)
                await bdLocal.elementosMenu.bulkPut(items);
                queryClient.invalidateQueries({ queryKey: ['menu'] });
            }

            // ── 2. Sincronizar pedidos activos ───────────────────────────────
            const resPedidos = await fetch(`${base}/api/pedidos`, {
                signal: AbortSignal.timeout(8000)
            });
            if (resPedidos.ok) {
                const pedidos = await resPedidos.json();
                await bdLocal.pedidos.bulkPut(pedidos);
                queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
                queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
                queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
            }

        } catch (err) {
            // Sin red o servidor no disponible — IndexedDB local como fallback
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
