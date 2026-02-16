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

class BaseDatosRestaurante extends Dexie {
    pedidos!: Table<Pedido>;
    itemsPedido!: Table<ItemPedido>;
    elementosMenu!: Table<ElementoMenu>;
    mesas!: Table<Mesa>;
    colaSincronizacion!: Table<OperacionSincronizacion>;

    constructor() {
        super('RestaurantePelusaBD');
        this.version(1).stores({
            pedidos: 'id, id_restaurante, estado, sincronizado, creado_en',
            itemsPedido: 'id, id_pedido, id_elemento_menu',
            elementosMenu: 'id, id_restaurante, categoria, disponible',
            mesas: 'id, id_restaurante, numero',
            colaSincronizacion: 'id, procesado, [tipo_entidad+id_entidad]' // Índice compuesto opcional
        });
    }
}

export const bdLocal = new BaseDatosRestaurante();
