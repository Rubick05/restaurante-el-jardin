import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useContextoRestaurante } from './useContextoRestaurante';
import { useQueryClient } from '@tanstack/react-query';

import { API_BASE_URL } from './useInicializacion';

const SOCKET_URL = API_BASE_URL;

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
