/**
 * Interfaces relacionadas con tratamientos médicos y sus tomas programadas.
 * Consolidado a partir de Users (métodos de tratamientos/tomas).
 */

export interface Tratamiento {
    idTratamiento: number;
    idPaciente: number;
    idDoctor?: number | null;
    idMedicamento: number;
    dosis: string;
    frecuenciaHoras: number;
    fechaInicio: string;
    fechaFin: string;
    notasInstrucciones?: string;
    activo?: boolean;
    created_at?: string;
    updated_at?: string;
}

/** Datos requeridos para crear un tratamiento */
export interface TratamientoCrear {
    idPaciente: number;
    idDoctor?: number | null;
    idMedicamento: number;
    dosis: string;
    frecuenciaHoras: number;
    fechaInicio: string;
    fechaFin: string;
    notasInstrucciones?: string;
    activo?: boolean;
}

export interface EstadisticasTratamientos {
    totalTratamientos: number;
    activos: number;
    finalizados: number;
    [key: string]: any;
}

// ==========================================================================
// TOMAS DE MEDICAMENTO
// ==========================================================================

export type EstadoToma = 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada' | 'Eliminada';

export interface RegistroToma {
    id?: number;
    idTratamiento: number;
    fechaProgramada: string;
    fechaRealizada?: string;
    estado: EstadoToma;
    notas?: string;
    idAcompanante?: number;
    nombreAcompanante?: string;
}

/** Datos para registrar una toma puntual */
export interface RegistrarTomaData {
    idTratamiento: number;
    fechaHoraProgramada: string;
    idAcompananteQueRegistro?: number;
    notasTomas?: string;
}

/** Datos para generar automáticamente las tomas de un tratamiento */
export interface GenerarTomasData {
    idTratamiento: number;
    fechaInicio: string;
    fechaFin: string;
    frecuenciaHoras: number;
}

export interface GenerarTomasResponse {
    message: string;
    totalGeneradas: number;
    tomas: RegistroToma[];
}

export interface EstadisticasTomas {
    totalTomas: number;
    tomasCompletadas: number;
    tomasPendientes: number;
    tomasOmitidas: number;
    tomasRetrasadas: number;
    porcentajeCumplimiento: number;
}