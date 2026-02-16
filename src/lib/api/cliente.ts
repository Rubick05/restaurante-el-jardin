const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface OpcionesCliente extends RequestInit {
    token?: string;
    tenantId?: string;
}

export async function clienteHttp<T>(endpoint: string, opciones: OpcionesCliente = {}): Promise<T> {
    const { token, tenantId, ...customConfig } = opciones;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...customConfig.headers,
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
    }

    const config: RequestInit = {
        ...customConfig,
        headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error HTTP: ${response.status} - ${errorBody}`);
    }

    // Si la respuesta es vacía, retornamos null
    if (response.status === 204) return null as T;

    try {
        const data = await response.json();
        return data;
    } catch (error) {
        return null as T;
    }
}
