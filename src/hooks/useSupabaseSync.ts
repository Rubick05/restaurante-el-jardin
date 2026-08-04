import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { normalizarPedidos, formatearFechaLocal } from './useInicializacion';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Inicializamos el cliente si las variables están configuradas
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

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
