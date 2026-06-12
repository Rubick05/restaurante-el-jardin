import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useContextoRestaurante } from './useContextoRestaurante';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export const usePedidosTiempoReal = () => {
    const { tenantId } = useContextoRestaurante();
    const queryClient = useQueryClient();

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            query: { tenantId },
            transports: ['websocket']
        });

        socket.on('pedido:nuevo', (data) => {
            // Invalidar query para recargar pedidos
            queryClient.invalidateQueries({ queryKey: ['pedidos'] });
        });

        socket.on('pedido:actualizado', (data) => {
            queryClient.invalidateQueries({ queryKey: ['pedidos'] });
        });

        socket.on('connect_error', (err) => {
            console.error('Error de conexión socket:', err);
        });

        return () => {
            socket.disconnect();
        };
    }, [tenantId, queryClient]);
};
