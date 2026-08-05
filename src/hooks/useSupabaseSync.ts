import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { normalizarPedidos, formatearFechaLocal } from './useInicializacion';

function obtenerClienteSupabaseSeguro() {
    try {
        let rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://ucnobrafrlvwdzonbhlc.supabase.co').trim().replace(/['"]/g, '');
        // Eliminar sufijo /rest/v1/ si fue copiado por error
        if (rawUrl.endsWith('/rest/v1/') || rawUrl.endsWith('/rest/v1')) {
            rawUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
        }
        if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
            rawUrl = `https://${rawUrl}`;
        }
        
        let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbm9icmFmcmx2d2R6b25iaGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDYyNDUsImV4cCI6MjA5NzM4MjI0NX0.-rYM2aTmDV3ohzUUg8uI4OSmoetFGJy4wEw_yrnSe04').trim().replace(/['"]/g, '');

        if (rawUrl && anonKey) {
            return createClient(rawUrl, anonKey);
        }
    } catch (e) {
        console.warn('⚠️ No se pudo inicializar Supabase Realtime:', e);
    }
    return null;
}

const supabase = obtenerClienteSupabaseSeguro();

export function useSupabaseSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!supabase) {
            console.warn('⚠️ Supabase URL o Anon Key no configurados. Tiempo real desactivado.');
            return;
        }

        console.log('🔗 Suscribiéndose a cambios en tiempo real con Supabase...');

        const channel = supabase.channel('schema-db-changes')
            // Escuchar cambios en la tabla 'pedidos'
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pedidos' },
                async (payload) => {
                    console.log('📢 Cambio detectado en pedidos:', payload);
                    const { bdLocal } = await import('@/lib/bd/bd-local');
                    
                    if (payload.eventType === 'INSERT') {
                        const pedido = payload.new as any;
                        if (pedido?.id) {
                            try {
                                const [normalizado] = normalizarPedidos([pedido]);
                                await bdLocal.pedidos.put(normalizado);
                            } catch (e) {
                                console.error('Error guardando pedido nuevo', e);
                            }
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const pedido = payload.new as any;
                        if (pedido?.id) {
                            try {
                                const local = await bdLocal.pedidos.get(pedido.id);
                                const [normalizado] = normalizarPedidos([{ ...local, ...pedido }]);
                                await bdLocal.pedidos.put(normalizado);
                            } catch (e) {
                                console.error('Error actualizando pedido local', e);
                            }
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const id = payload.old?.id;
                        if (id) {
                            try {
                                await bdLocal.pedidos.delete(id);
                            } catch (e) {
                                console.error('Error borrando pedido local', e);
                            }
                        }
                    }

                    // Invalidar queries relevantes en React Query
                    queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
                    queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
                    queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
                    queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
                }
            )
            // Escuchar cambios en la tabla 'elementos_menu'
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'elementos_menu' },
                (payload) => {
                    console.log('📢 Cambio detectado en elementos_menu:', payload);
                    queryClient.invalidateQueries({ queryKey: ['menu'] });
                }
            )
            // Escuchar cambios en la tabla 'gastos'
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'gastos' },
                async (payload) => {
                    console.log('📢 Cambio detectado en gastos:', payload);
                    const { bdLocal } = await import('@/lib/bd/bd-local');

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const gasto = payload.new as any;
                        if (gasto?.id) {
                            try {
                                await bdLocal.gastos.put({
                                    ...gasto,
                                    monto: Number(gasto.monto ?? 0),
                                    fecha: gasto.fecha ? formatearFechaLocal(gasto.fecha) : formatearFechaLocal(new Date()),
                                    sincronizado: true
                                });
                            } catch (e) {
                                console.error('Error guardando gasto en tiempo real', e);
                            }
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const id = payload.old?.id;
                        if (id) {
                            try {
                                await bdLocal.gastos.delete(id);
                            } catch (e) {
                                console.error('Error borrando gasto local', e);
                            }
                        }
                    }
                    queryClient.invalidateQueries({ queryKey: ['gastos'] });
                }
            )
            // Escuchar cambios en la tabla 'dias_cerrados'
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'dias_cerrados' },
                (payload) => {
                    console.log('📢 Cambio detectado en dias_cerrados:', payload);
                    queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
                    queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
                    queryClient.invalidateQueries({ queryKey: ['resumen-dia'] });
                }
            )
            .subscribe((status) => {
                console.log(`📡 Estado de canal Supabase Realtime: ${status}`);
            });

        return () => {
            if (supabase) {
                supabase.removeChannel(channel);
            }
        };
    }, [queryClient]);
}
