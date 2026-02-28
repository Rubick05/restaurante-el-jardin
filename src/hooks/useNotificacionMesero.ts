/**
 * useNotificacionMesero.ts
 *
 * Hook que escucha eventos de WebSocket para notificar al mesero
 * con VIBRACIÓN + SONIDO cuando algún plato del pedido está listo.
 *
 * Funciona en móvil (Vibration API) y escritorio (Web Audio API).
 * Se instala dentro de VistaMesero para que solo los camareros reciban alertas.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/contexto-auth';

// Genera un sonido de timbre suave con Web Audio API (sin archivos externos)
function tocarSonido() {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

        const tocar = (frecuencia: number, inicio: number, duracion: number, tipo: OscillatorType = 'sine') => {
            const osc = audioCtx.createOscillator();
            const gananancia = audioCtx.createGain();

            osc.type = tipo;
            osc.frequency.value = frecuencia;
            gananancia.gain.setValueAtTime(0.001, audioCtx.currentTime + inicio);
            gananancia.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + inicio + 0.01);
            gananancia.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + inicio + duracion);

            osc.connect(gananancia);
            gananancia.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + inicio);
            osc.stop(audioCtx.currentTime + inicio + duracion + 0.05);
        };

        // Tono de timbre: dos notas ascendentes
        tocar(880, 0, 0.25);
        tocar(1100, 0.3, 0.25);
        tocar(880, 0.6, 0.25);
        tocar(1100, 0.9, 0.35);

        // Cerrar contexto de audio al finalizar
        setTimeout(() => audioCtx.close(), 2000);
    } catch (e) {
        console.warn('No se pudo reproducir sonido de notificación', e);
    }
}

// Vibración en móviles: patrón dot-dot-dash
function vibrar() {
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
}

export function useNotificacionMesero(pedidosActivos: any[]) {
    const { usuarioActual } = useAuth();
    const notificadosRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Solo activo para camareros
        if (!usuarioActual || usuarioActual.rol !== 'camarero') return;
        if (!pedidosActivos || pedidosActivos.length === 0) return;

        let sonar = false;

        pedidosActivos.forEach(pedido => {
            // Solo notificar si el pedido es de este mesero
            if (pedido.id_mesero !== usuarioActual.id) return;

            // Verificar si el pedido entero está 'listo'
            if (pedido.estado === 'listo') {
                const claveGlobal = `${pedido.id}-GLOBAL-LISTO`;
                if (!notificadosRef.current.has(claveGlobal)) {
                    notificadosRef.current.add(claveGlobal);
                    sonar = true;
                    const fichaNum = pedido.numero_ficha ?? '?';
                    const msg = `✅ Ficha #${fichaNum}: ¡TODOS los platos listos!`;
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('¡Pedido Completo Listo! ✅', { body: msg, icon: '/icon-192.png' });
                    }
                    console.info('🔔', msg);
                }
            }

            // Verificar ítems individuales
            const items = pedido.items ?? [];
            for (const item of items) {
                if (item.estado_item === 'listo') {
                    const clave = `${pedido.id}-${item.id}`;
                    if (!notificadosRef.current.has(clave)) {
                        notificadosRef.current.add(clave);
                        sonar = true;
                        const fichaNum = pedido.numero_ficha ?? '?';
                        const msg = `🍽️ Ficha #${fichaNum}: "${item.nombre_item}" está listo en cocina`;
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('¡Plato Listo! 🔔', { body: msg, icon: '/icon-192.png' });
                        }
                        console.info('🔔', msg);
                    }
                }
                // Si está entregado, solo lo marcamos para no notificarlo en el futuro
                if (item.estado_item === 'entregado') {
                    notificadosRef.current.add(`${pedido.id}-${item.id}`);
                }
            }
        });

        if (sonar) {
            tocarSonido();
            vibrar();
        }

        // Solicitar permisos de notificación al arrancar por si acaso
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

    }, [pedidosActivos, usuarioActual]);
}
