import { useEffect, useState } from 'react';
import { motorSincronizacion } from '../lib/bd/motor-sincronizacion';
import { useContextoRestaurante } from './useContextoRestaurante';

export const useSincronizacionOffline = () => {
    const { tenantId } = useContextoRestaurante();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            motorSincronizacion.procesarCola(tenantId);
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial sync attempt on mount
        if (navigator.onLine) {
            motorSincronizacion.procesarCola(tenantId);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [tenantId]);

    return { isOnline };
};
