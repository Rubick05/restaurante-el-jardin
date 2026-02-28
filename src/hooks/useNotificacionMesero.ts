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
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth/contexto-auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';

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

let socketNotif: Socket | null = null;

export function useNotificacionMesero() {
    const { usuarioActual } = useAuth();
    const notificadosRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Solo activo para camareros
        if (!usuarioActual || usuarioActual.rol !== 'camarero') return;
        if (!API_URL) return;

        socketNotif = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
        });

        const procesarActualizacion = (data: any) => {
            const pedido = data?.pedido ?? data;
            if (!pedido) return;

            const items: any[] = pedido.items ?? [];
            const idMesero = pedido.id_mesero;

            // Solo notificar si el pedido es de este mesero
            if (idMesero !== usuarioActual.id) return;

            // Verificar si hay items recién "listos" que aún no se notificaron
            for (const item of items) {
                if (item.estado_item === 'listo' || item.estado_item === 'entregado') {
                    const clave = `${pedido.id}-${item.id}`;
                    if (!notificadosRef.current.has(clave)) {
                        notificadosRef.current.add(clave);

                        // Disparar notificación una sola vez
                        tocarSonido();
                        vibrar();

                        // Mostrar notificación nativa del navegador si hay permiso
                        const fichaNum = pedido.numero_ficha ?? '?';
                        const msg = `🍽️ Ficha #${fichaNum}: "${item.nombre_item}" listo para entregar`;

                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('¡Plato Listo! 🔔', { body: msg, icon: '/icon-192.png' });
                        }
                        console.info('🔔', msg);
                    }
                }
            }

            // Si el pedido entero está en estado 'listo', notificación especial
            if (pedido.estado === 'listo') {
                const claveGlobal = `${pedido.id}-GLOBAL-LISTO`;
                if (!notificadosRef.current.has(claveGlobal)) {
                    notificadosRef.current.add(claveGlobal);
                    tocarSonido();
                    vibrar();

                    const msg = `✅ Ficha #${pedido.numero_ficha ?? '?'}: ¡TODOS los platos listos!`;
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('¡Pedido Completo Listo! ✅', { body: msg, icon: '/icon-192.png' });
                    }
                }
            }
        };

        socketNotif.on('pedido:actualizado', procesarActualizacion);
        socketNotif.on('pedido:item_actualizado', (data: any) => {
            // data = { id_pedido, item }
            const item = data?.item;
            const pedidoId = data?.id_pedido;
            if (!item || !pedidoId) return;

            if (item.estado_item === 'listo') {
                const clave = `${pedidoId}-${item.id}`;
                if (!notificadosRef.current.has(clave)) {
                    notificadosRef.current.add(clave);
                    tocarSonido();
                    vibrar();

                    const msg = `🍽️ "${item.nombre_item ?? 'Plato'}" está listo en la cocina`;
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('¡Plato Listo! 🔔', { body: msg, icon: '/icon-192.png' });
                    }
                }
            }
        });

        // Solicitar permisos de notificación al conectarse
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            socketNotif?.disconnect();
            socketNotif = null;
        };
    }, [usuarioActual]);
}
