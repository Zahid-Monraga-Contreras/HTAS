/**
 * Interfaces relacionadas con el catálogo de medicamentos.
 * Consolidado a partir de Users (métodos de medicamentos).
 * NOTA: ajustar nombres de campos si el backend usa snake_case
 * en la respuesta (ej. nombre_comercial en vez de nombreComercial).
 */

export interface Medicamento {
    idMedicamento: number;
    nombreComercial: string;
    sustanciaActiva?: string;
    presentacion: string;
    concentracion?: string;
    laboratorio?: string;
    indicacionesGenerales?: string;
    created_at?: string;
    updated_at?: string;
}

/** Datos requeridos para crear un medicamento */
export interface MedicamentoCrear {
    nombreComercial: string;
    sustanciaActiva?: string;
    presentacion: string;
    concentracion?: string;
    laboratorio?: string;
    indicacionesGenerales?: string;
}

/** Parámetros de búsqueda/filtro de medicamentos */
export interface MedicamentoFiltro {
    busqueda?: string;
    laboratorio?: string;
}

export interface EstadisticasMedicamentos {
    totalMedicamentos: number;
    totalLaboratorios?: number;
    masRecetado?: Medicamento;
    [key: string]: any;
}

export interface EstadisticasMedicamento {
    idMedicamento: number;
    vecesRecetado: number;
    pacientesActivos?: number;
    [key: string]: any;
}