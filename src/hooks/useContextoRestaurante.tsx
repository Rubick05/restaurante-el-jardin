import React, { createContext, useContext, useState } from 'react';

interface RestauranteContextoType {
    tenantId: string;
    nombre: string;
    setTenantId: (id: string) => void;
}

const RestauranteContexto = createContext<RestauranteContextoType | undefined>(undefined);

export const ProveedorRestaurante: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tenantId, setTenantId] = useState<string>('restaurante-demo-1');
    const [nombre] = useState<string>('Restaurante Demo');

    const value = { tenantId, nombre, setTenantId };

    return (
        <RestauranteContexto.Provider value={value}>
            {children}
        </RestauranteContexto.Provider>
    );
};

export const useContextoRestaurante = () => {
    const context = useContext(RestauranteContexto);
    if (context === undefined) {
        throw new Error('useContextoRestaurante debe usarse dentro de un ProveedorRestaurante');
    }
    return context;
};
