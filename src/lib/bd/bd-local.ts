import Dexie, { Table } from 'dexie';

// Interfaces alineadas con el esquema de la base de datos
export interface Pedido {
    id: string;
    id_restaurante: string;
    id_mesa: string;
    id_mesero: string;
    numero_pedido: string;
    estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'listo' | 'entregado' | 'pagado' | 'cancelado';
    tipo_pedido: 'mesa' | 'llevar' | 'delivery';
    subtotal: number;
    impuesto: number;
    total: number;
    notas?: string;
    numero_ficha: number; // Número secuencial del día (1, 2, 3...)
    numero_letrero?: string; // Letrero físico para ubicación (1-30)
    datos_facturacion?: {
        tipo: 'factura' | 'recibo';
        nit_ci?: string;
        razon_social?: string;
    };
    creado_en: string; // ISO String
    actualizado_en: string;
    version: number;
    sincronizado: boolean;
    items?: {
        id_elemento_menu: string;
        nombre_item: string;
        cantidad: number;
        precio_unitario: number;
        subtotal: number;
        categoria?: string; // Nuevo campo para filtrar en cocina
        estado_item?: 'pendiente' | 'en_proceso' | 'listo' | 'entregado'; // Estado individual del item
    }[];
}

export interface ItemPedido {
    id: string;
    id_restaurante: string;
    id_pedido: string;
    id_elemento_menu: string;
    nombre_item: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    instrucciones_especiales?: string;
    creado_en: string;
}

export interface ElementoMenu {
    id: string;
    id_restaurante: string;
    nombre: string;
    descripcion?: string;
    categoria: string;
    url_imagen?: string;
    imagen_base64?: string;  // Imagen subida por el admin (base64)
    precio_actual: number;
    disponible: boolean;
    actualizado_en: string;
}

export interface OperacionSincronizacion {
    id: string;
    id_restaurante: string;
    tipo_entidad: 'pedido' | 'item_pedido' | 'elemento_menu';
    id_entidad: string;
    operacion: 'crear' | 'actualizar' | 'eliminar';
    carga_util: any;
    timestamp_cliente: string;
    procesado: boolean;
    conteo_reintentos: number;
}

export interface Mesa {
    id: string;
    id_restaurante: string;
    numero: string;
    zona: string;
    capacidad: number;
    estado: 'disponible' | 'ocupada' | 'atencion' | 'limpieza';
    posX: number;
    posY: number;
}

export interface DiaCerrado {
    id: string;           // fecha YYYY-MM-DD
    fecha: string;        // fecha ISO legible
    total_recaudado: number;
    total_pedidos: number;
    total_items: number;
    pedidos_snapshot: string; // JSON stringify de los pedidos del día
    cerrado_en: string;   // ISO timestamp del cierre
}

class BaseDatosRestaurante extends Dexie {
    pedidos!: Table<Pedido>;
    itemsPedido!: Table<ItemPedido>;
    elementosMenu!: Table<ElementoMenu>;
    mesas!: Table<Mesa>;
    colaSincronizacion!: Table<OperacionSincronizacion>;
    diasCerrados!: Table<DiaCerrado>;

    constructor() {
        super('RestaurantePelusaBD');
        this.version(1).stores({
            pedidos: 'id, id_restaurante, estado, sincronizado, creado_en',
            itemsPedido: 'id, id_pedido, id_elemento_menu',
            elementosMenu: 'id, id_restaurante, categoria, disponible',
            mesas: 'id, id_restaurante, numero',
            colaSincronizacion: 'id, procesado, [tipo_entidad+id_entidad]'
        });
        this.version(2).stores({
            pedidos: 'id, id_restaurante, estado, sincronizado, creado_en',
            itemsPedido: 'id, id_pedido, id_elemento_menu',
            elementosMenu: 'id, id_restaurante, categoria, disponible',
            mesas: 'id, id_restaurante, numero',
            colaSincronizacion: 'id, procesado, [tipo_entidad+id_entidad]',
            diasCerrados: 'id, fecha, cerrado_en'
        });
    }
}

export const bdLocal = new BaseDatosRestaurante();

import { v4 as uuidv4 } from 'uuid';

export const inicializarMenuBD = async () => {
    try {
        const count = await bdLocal.elementosMenu.count();
        if (count === 0) {
            console.log("Inicializando menú por defecto...");
            const platos: ElementoMenu[] = [
                // --- PLATOS FUERTES ---
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Pique (Media)', precio_actual: 80, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Pique (Entero)', precio_actual: 120, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Planchita (Media)', precio_actual: 80, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Planchita (Entera)', precio_actual: 120, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Charque (Media)', precio_actual: 80, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Charque (Entero)', precio_actual: 120, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Lambreado de Conejo', precio_actual: 80, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Lapping', precio_actual: 80, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Jatun Pampaku', precio_actual: 110, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Chillami', precio_actual: 120, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Alitas', precio_actual: 25, categoria: 'Plato Fuerte', disponible: true, actualizado_en: new Date().toISOString() },
                // --- CALDOS ---
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Lomito Borracho', precio_actual: 30, categoria: 'Caldos', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Kawi', precio_actual: 20, categoria: 'Caldos', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Fideos Uchu (Personal)', precio_actual: 40, categoria: 'Caldos', disponible: true, actualizado_en: new Date().toISOString() },
                // --- REFRESCOS ---
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Coca Cola 2L', precio_actual: 15, categoria: 'Refrescos', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Coca Cola Personal', precio_actual: 8, categoria: 'Refrescos', disponible: true, actualizado_en: new Date().toISOString() },
                // --- CERVEZAS ---
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Cerveza Huari', precio_actual: 20, categoria: 'Cervezas', disponible: true, actualizado_en: new Date().toISOString() },
                { id: uuidv4(), id_restaurante: 'demo', nombre: 'Cerveza Paceña', precio_actual: 18, categoria: 'Cervezas', disponible: true, actualizado_en: new Date().toISOString() },
            ];
            await bdLocal.elementosMenu.bulkAdd(platos);
            console.log("Menú por defecto cargado exitosamente.");
        }
    } catch (error) {
        console.error("Error al inicializar el menú de la BD:", error);
    }
};
