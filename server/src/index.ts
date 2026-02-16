import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { pool } from './bd/pool';

// Intentar cargar .env desde la raíz del proyecto (2 niveles arriba de server/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// También cargar el local de server/ por si acaso
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // En producción, restringir al dominio de la PWA
        methods: ["GET", "POST"]
    }
});

import pedidosRouter from './rutas/pedidos';
import sincronizacionRouter from './rutas/sincronizacion';
import { inicializarSocket } from './sincronizacion/emisor-tiempo-real';

// Inicializar helper de sockets
inicializarSocket(io);

// ... (después de cors/json)
app.use(cors());
app.use(express.json());

// Rutas API
app.use('/api/pedidos', pedidosRouter);
app.use('/api/sincronizar', sincronizacionRouter);

// Servir frontend en producción
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
    });
}

const PORT = process.env.PORT || 3001;


// --- Endpoints Básicos ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint ejemplo para probar conexión BD
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ ok: true, server_time: result.rows[0].now });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// --- Manejo de WebSockets (Sincronización) ---
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });

    // Aquí manejaremos eventos de sync más adelante
});

httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor Backend corriendo en h http://localhost:${PORT}`);
});
