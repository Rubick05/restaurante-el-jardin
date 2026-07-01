import { Router } from 'express';
import { pool } from '../bd/pool';

const router = Router();

router.post('/', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
        const msg = 'GEMINI_API_KEY no configurado en el servidor. Agrega la variable de entorno en server/.env (local) y en Railway (producción).';
        console.error('❌ Chat IA:', msg);
        return res.status(500).json({ 
            error: 'El chatbot de IA no está configurado. Contacta al administrador.',
            _debug: process.env.NODE_ENV !== 'production' ? msg : undefined
        });
    }

    try {
        const { messages } = req.body;
        if (!Array.isArray(messages)) {
            return res.status(400).json({ error: 'El cuerpo de la petición debe contener un array de mensajes.' });
        }

        // ─── Obtener menú de la base de datos en tiempo real ───
        const menuRes = await pool.query(
            'SELECT nombre, categoria, precio_actual, disponible, descripcion FROM elementos_menu ORDER BY categoria, nombre'
        );
        const menuItems = menuRes.rows;

        // Clasificar platos activos e inactivos
        const activos = menuItems.filter(item => item.disponible !== false);
        const inactivos = menuItems.filter(item => item.disponible === false);

        // Generar texto descriptivo del menú para el prompt del sistema
        const menuActivoTexto = activos.map(item => 
            `- ${item.nombre} (${item.categoria}): Bs. ${Number(item.precio_actual).toFixed(0)}${item.descripcion ? ` - ${item.descripcion}` : ''}`
        ).join('\n');

        const menuInactivoTexto = inactivos.map(item => 
            `- ${item.nombre}`
        ).join('\n');

        // Convertir formato de mensajes a Gemini
        const formattedContents = messages.map((m: any) => {
            const role = m.role === 'assistant' ? 'model' : 'user';
            return {
                role,
                parts: [{ text: m.content || '' }]
            };
        });

        const systemPrompt = `
Eres el Asistente Inteligente de "Restaurante El Jardín", un restaurante tradicional y peña folclórica en Cochabamba, Bolivia.
Tu objetivo es ayudar de forma cálida y amable a los usuarios de la web con sus consultas y guiarlos en el proceso de reserva de mesa o pedidos anticipados.

INFORMACIÓN CLAVE DEL RESTAURANTE:
- Ubicación: Final de la Av. Melchor Pérez de Olguín, Cochabamba, Bolivia. Enlace a Google Maps: https://maps.app.goo.gl/S5uYzZB4ZRNTUoV16.
- Horarios de Atención al Público:
  * Jueves: 11:00 AM — 11:00 PM (23:00) hs
  * Sábado y Domingo: 12:00 PM — 11:00 PM (23:00) hs
  * Lunes, Martes, Miércoles y Viernes el restaurante permanece CERRADO.
- Teléfono/WhatsApp de Reservas: +591 69420202.

MENÚ Y DISPONIBILIDAD EN TIEMPO REAL (Extraído de la base de datos hoy):

PLATOS DISPONIBLES HOY (ACTIVOS):
${menuActivoTexto || '_No hay platos disponibles cargados actualmente._'}

PLATOS NO DISPONIBLES HOY (INACTIVOS - No se pueden ordenar por ahora):
${menuInactivoTexto || '_Todos los platos están disponibles._'}

REGLAS DE COMPORTAMIENTO:
1. Sé muy servicial, educado y usa modismos bolivianos amables de forma natural ("¡Bienvenido a El Jardín!", "con gusto", "claro que sí").
2. Si el usuario te pregunta qué platos hay disponibles hoy, lístale de forma organizada y bonita los "PLATOS DISPONIBLES HOY" clasificados por categorías (ej. Platos Tradicionales, Caldos, Bebidas). No menciones los platos inactivos a menos que te pregunten específicamente por alguno de ellos, en cuyo caso indica amablemente que "no lo tenemos disponible hoy".
3. Si el usuario desea reservar, pregúntale amablemente:
   - Su nombre.
   - Cantidad de personas.
   - Fecha (valida que sea Jueves, Sábado o Domingo).
   - Hora de llegada.
   - Platos que desea pre-ordenar de la lista de disponibles (opcional).
4. Cuando el usuario exprese la intención clara de reservar o proporcione datos, establece 'action: "open_reserva"' e incluye los campos detectados en 'reservaData'. No es necesario que los datos estén completos para abrir el formulario interactivo; si el usuario dice "Quiero reservar", activa la acción para ayudarle a rellenar el formulario visual de inmediato.
5. Mantén tus respuestas claras y no demasiado extensas. Usa viñetas.
`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: formattedContents,
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            response: {
                                type: 'STRING',
                                description: 'Respuesta amable en español.'
                            },
                            action: {
                                type: 'STRING',
                                enum: ['open_reserva', 'none'],
                                description: 'open_reserva si el cliente quiere reservar o pre-ordenar, o none.'
                            },
                            reservaData: {
                                type: 'OBJECT',
                                description: 'Datos recopilados de la conversación.',
                                properties: {
                                    nombre: { type: 'STRING' },
                                    personas: { type: 'INTEGER' },
                                    fecha: { type: 'STRING', description: 'YYYY-MM-DD' },
                                    hora: { type: 'STRING', description: 'HH:MM' },
                                    platos: {
                                        type: 'ARRAY',
                                        items: {
                                            type: 'OBJECT',
                                            properties: {
                                                nombre: { type: 'STRING' },
                                                cantidad: { type: 'INTEGER' }
                                            },
                                            required: ['nombre', 'cantidad']
                                        }
                                    }
                                }
                            }
                        },
                        required: ['response', 'action']
                    }
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error de Gemini API en backend:', errorText);
            return res.status(response.status).json({ error: 'Error en servicio de Inteligencia Artificial.' });
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            throw new Error('Respuesta vacía de Gemini API.');
        }

        const parsedResult = JSON.parse(resultText);
        return res.status(200).json(parsedResult);

    } catch (err: any) {
        console.error('Excepción en /api/chat del backend:', err);
        return res.status(500).json({ error: 'Error interno al procesar el chat.' });
    }
});

export default router;
