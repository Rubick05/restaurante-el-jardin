import { Router } from 'express';
import { pool } from '../bd/pool';

const router = Router();

// GET /api/usuarios
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, usuario, rol, creado_en FROM usuarios ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/usuarios (Crear usuario)
router.post('/', async (req, res) => {
    try {
        const { nombre, usuario, password, rol } = req.body;

        // Verificar si existe
        const exist = await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario.trim().toLowerCase()]);
        if (exist.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        const r = await pool.query(`
            INSERT INTO usuarios (nombre, usuario, password, rol)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nombre, usuario, rol, creado_en
        `, [nombre, usuario.trim().toLowerCase(), password, rol]);

        res.json({ ok: true, usuario: r.rows[0] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/usuarios/:id (Editar usuario: nombre, password, rol)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, password, rol, usuario } = req.body;
    try {
        // Verificar duplicidad de username en otro id
        if (usuario) {
            const check = await pool.query('SELECT id FROM usuarios WHERE usuario = $1 AND id != $2', [usuario.trim().toLowerCase(), id]);
            if (check.rows.length > 0) {
                return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
            }
        }

        const campos = [];
        const values = [];
        let idx = 1;

        if (nombre) { campos.push(`nombre = $${idx++}`); values.push(nombre); }
        if (usuario) { campos.push(`usuario = $${idx++}`); values.push(usuario.trim().toLowerCase()); }
        if (password) { campos.push(`password = $${idx++}`); values.push(password); }
        if (rol) { campos.push(`rol = $${idx++}`); values.push(rol); }

        if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

        values.push(id);
        const r = await pool.query(`
            UPDATE usuarios SET ${campos.join(', ')}
            WHERE id = $${idx}
            RETURNING id, nombre, usuario, rol, creado_en
        `, values);

        res.json({ ok: true, usuario: r.rows[0] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Validación extra: no eliminar si es el último admin
        const adminCheck = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'administrador'");
        const currentUsr = await pool.query("SELECT rol FROM usuarios WHERE id = $1", [id]);

        if (currentUsr.rows.length > 0 && currentUsr.rows[0].rol === 'administrador' && parseInt(adminCheck.rows[0].count) <= 1) {
            return res.status(400).json({ error: 'No puedes eliminar al único administrador del sistema' });
        }

        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/usuarios/login
router.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const r = await pool.query('SELECT id, nombre, usuario, password, rol FROM usuarios WHERE usuario = $1', [usuario.trim().toLowerCase()]);
        const user = r.rows[0];

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const { password: _pw, ...userWithoutPassword } = user;
        res.json({ ok: true, usuario: userWithoutPassword });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
