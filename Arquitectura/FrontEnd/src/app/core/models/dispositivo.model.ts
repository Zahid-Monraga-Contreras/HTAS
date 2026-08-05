export interface Dispositivo {
    iddispositivo: number;
    nombre: string;
    direccionmac: string;
    idpacienteasociado?: number | null;
    activo: boolean;
    created_at: string;
    updated_at: string;
    paciente?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
    };
}

export interface DispositivoData {
    nombre: string;
    direccionMac: string;
    idPacienteAsociado?: number | null;
    activo?: boolean;
}

export interface DispositivoFiltros {
    paciente?: number;
    activo?: boolean;
    busqueda?: string;
}

export interface DispositivoEstadisticas {
    total: number;
    activos: number;
    inactivos: number;
    porPaciente: Array<{
        idpaciente: number;
        nombre: string;
        total: number;
    }>;
}