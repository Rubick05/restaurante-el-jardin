import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export const inicializarSocket = (io: Server) => {
    ioInstance = io;
};

export const emisorTiempoReal = {
    notificarCambio: (tenantId: string, entidad: string, operacion: string, data: any) => {
        if (!ioInstance) return;

        // Emitir a la sala del tenat (asumiendo que los clientes se unen a una sala id_restaurante)
        // Por ahora emitimos globalmente o filtramos en cliente
        // ioInstance.to(tenantId).emit(`${entidad}:${operacion}`, data);

        // Simple para MVP:
        ioInstance.emit(`${entidad}:${operacion}`, data);
    }
};
