export interface Medicamento {
    idmedicamento: number;
    nombrecomercial: string;
    sustanciaactiva?: string;
    presentacion: string;
    concentracion?: string;
    laboratorio?: string;
    indicacionesgenerales?: string;
    activo: boolean;
    created_at: string;
    updated_at: string;
}

export interface CrearMedicamentoRequest {
    nombreComercial: string;
    sustanciaActiva?: string;
    presentacion: string;
    concentracion?: string;
    laboratorio?: string;
    indicacionesGenerales?: string;
}

export interface MedicamentoFiltros {
    busqueda?: string;
    laboratorio?: string;
}

export interface MedicamentoEstadisticas {
    total: number;
    masRecetados: Array<{
        idmedicamento: number;
        nombrecomercial: string;
        total_recetas: number;
    }>;
    porLaboratorio: Array<{
        laboratorio: string;
        total: number;
    }>;
}