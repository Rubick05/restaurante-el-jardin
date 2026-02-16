
interface OperacionData {
    id: string;
    actualizado_en?: string;
    [key: string]: any;
}

export const resolutorConflictos = {
    debeAplicarCambio: (entidadExistente: OperacionData | undefined, cargaUtil: OperacionData): boolean => {
        if (!entidadExistente) return true; // Si no existe, aplicar siempre (creación o primera sync)

        // Comparar timestamps si existen
        const fechaExistente = entidadExistente.actualizado_en ? new Date(entidadExistente.actualizado_en).getTime() : 0;
        const fechaNueva = cargaUtil.actualizado_en ? new Date(cargaUtil.actualizado_en).getTime() : 0;

        // Last Write Wins (simple)
        return fechaNueva >= fechaExistente;
    }
};
