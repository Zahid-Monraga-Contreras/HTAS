/**
 * Interfaces relacionadas con los dispositivos (tensiómetros) vinculados
 * a un paciente. Consolidado a partir de Users (métodos de dispositivos).
 */

export interface Dispositivo {
    idDispositivo: number;
    nombre: string;
    direccionMac: string;
    idPacienteAsociado?: number | null;
    activo?: boolean;
    created_at?: string;
    updated_at?: string;
}

/** Datos requeridos para crear/actualizar un dispositivo */
export interface DispositivoData {
    nombre: string;
    direccionMac: string;
    idPacienteAsociado?: number | null;
    activo?: boolean;
}

/** Parámetros de filtro para listar dispositivos */
export interface DispositivoFiltro {
    paciente?: number;
    activo?: boolean;
    busqueda?: string;
}

export interface EstadisticasDispositivos {
    totalDispositivos: number;
    activos: number;
    inactivos: number;
    [key: string]: any;
}