import { Router } from 'express';
import { procesadorCola } from '../sincronizacion/procesador-cola';

const router = Router();

router.post('/', async (req, res) => {
    try {
        const { operaciones } = req.body;
        // Simular obtención de tenantId desde headers o auth
        const tenantId = req.headers['x-tenant-id'] as string || 'demo';

        const resultado = await procesadorCola.procesarLote(operaciones, tenantId);
        res.json(resultado);
    } catch (error: any) {
        console.error("Error en endpoint sync:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
