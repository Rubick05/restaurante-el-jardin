/**
 * useSocketSync.ts
 *
 * Hook que mantiene una conexión Socket.io con el servidor Railway.
 * Cuando llegan cambios (nuevo pedido, actualización, cierre de día),
 * invalida automáticamente las queries de TanStack para que todos
 * los componentes se refresquen sin polling manual.
 *
 * Uso:
 *   En el componente raíz (App.tsx o main.tsx):
 *   useSocketSync();   ← basta con llamarlo una vez
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

let socket: Socket | null = null;

export function useSocketSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!API_URL) return; // offline mode — no hay servidor

        socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
            console.log('🔗 Socket conectado al servidor');
        });

        socket.on('connect_error', (err) => {
            console.warn('⚠️ Socket sin conexión:', err.message);
        });

        // ── Eventos de Pedidos ──────────────────────────────────
        socket.on('pedido:nuevo', async (pedido: any) => {
            if (pedido?.id) {
                try {
                    const { bdLocal } = await import('@/lib/bd/bd-local');
                    await bdLocal.pedidos.put({ ...pedido, sincronizado: true });
                } catch (e) { console.error('Error guardando pedido nuevo', e); }
            }
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        });

        socket.on('pedido:actualizado', async (pedido: any) => {
            if (pedido?.id) {
                try {
                    const { bdLocal } = await import('@/lib/bd/bd-local');
                    const local = await bdLocal.pedidos.get(pedido.id);
                    await bdLocal.pedidos.put({ ...local, ...pedido, sincronizado: true });
                } catch (e) { console.error('Error actualizando pedido local', e); }
            }
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        });

        socket.on('pedido:item_actualizado', async (data: any) => {
            const id_pedido = data?.id_pedido;
            const item = data?.item;
            if (id_pedido && item) {
                try {
                    const { bdLocal } = await import('@/lib/bd/bd-local');
                    const pedidoLocal = await bdLocal.pedidos.get(id_pedido);
                    if (pedidoLocal) {
                        const nuevosItems = pedidoLocal.items?.map(it =>
                            it.id === item.id ? { ...it, ...item } : it
                        ) ?? [];
                        await bdLocal.pedidos.update(id_pedido, { items: nuevosItems, actualizado_en: new Date().toISOString() });
                    }
                } catch (e) { console.error('Error actualizando item local', e); }
            }
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
        });

        socket.on('pedido:eliminado', async (data: { id: string }) => {
            if (data?.id) {
                // Eliminar físicamente de IndexedDB local
                try {
                    const { bdLocal } = await import('@/lib/bd/bd-local');
                    await bdLocal.pedidos.delete(data.id);
                } catch (e) {
                    console.error('Error borrando pedido local en tiempo real', e);
                }
            }
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
        });

        // ── Eventos de Menú ─────────────────────────────────────
        socket.on('menu:actualizado', () => {
            queryClient.invalidateQueries({ queryKey: ['menu'] });
        });
        socket.on('menu:eliminado', () => {
            queryClient.invalidateQueries({ queryKey: ['menu'] });
        });

        // ── Eventos de Día ──────────────────────────────────────
        socket.on('dia:cerrado', () => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
            queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
            queryClient.invalidateQueries({ queryKey: ['resumen-dia'] });
        });

        // ── Limpieza masiva de pedidos (solo pruebas) ─────────
        socket.on('pedido:todos_eliminados', async () => {
            try {
                const { bdLocal } = await import('@/lib/bd/bd-local');
                await bdLocal.pedidos.clear();
            } catch (e) {
                console.error('Error limpiando pedidos locales', e);
            }
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        });

        return () => {
            socket?.disconnect();
            socket = null;
        };
    }, [queryClient]);
}
