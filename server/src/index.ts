import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { pool, inicializarBaseDeDatos } from './bd/pool';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

import pedidosRouter from './rutas/pedidos';
import menuRouter from './rutas/menu';
import historialRouter from './rutas/historial';
import { inicializarSocket } from './sincronizacion/emisor-tiempo-real';

inicializarSocket(io);

app.use(cors());
app.use(express.json({ limit: '20mb' })); // limit grande para imágenes base64

// ─── API Routes ───
app.use('/api/pedidos', pedidosRouter);
app.use('/api/menu', menuRouter);
app.use('/api/historial', historialRouter);

// ─── Health check ───
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── DB test ───
app.get('/api/test-db', async (_req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ ok: true, server_time: result.rows[0].now });
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── Servir frontend en producción ───
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../../dist');
    app.use(express.static(distPath));
    // SPA fallback — todas las rutas no-API devuelven el index.html
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// ─── Socket.io ───
io.on('connection', (socket) => {
    console.log('📱 Cliente conectado:', socket.id);
    socket.on('disconnect', () => console.log('📴 Cliente desconectado:', socket.id));
});

const PORT = process.env.PORT || 3001;

// Inicializar BD y luego arrancar el servidor
inicializarBaseDeDatos().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`🚀 Servidor El Jardín en http://localhost:${PORT}`);
    });
});
