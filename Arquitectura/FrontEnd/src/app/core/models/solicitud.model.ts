export interface Solicitud {
    idsolicitud: number;
    idacompanante: number;
    correopaciente: string;
    parentesco: string;
    notas?: string;
    estado: 'Pendiente' | 'Aprobada' | 'Rechazada';
    idadmin?: number | null;
    motivo_rechazo?: string;
    created_at: string;
    updated_at: string;
    acompanante?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
        apMaterno?: string;
        correo: string;
    };
    paciente?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
        apMaterno?: string;
        correo: string;
    };
    admin?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
    };
}

export interface CrearSolicitudRequest {
    correoPaciente: string;
    parentesco: string;
    notas: string;
}

export interface AprobarSolicitudRequest {
    idAdmin: number;
}

export interface RechazarSolicitudRequest {
    idAdmin: number;
    motivo?: string;
}

export interface Asignacion {
    idasignacion: number;
    idacompanante: number;
    idpaciente: number;
    parentesco: string;
    idsolicitud: number;
    activo: boolean;
    created_at: string;
    updated_at: string;
    acompanante?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
        apMaterno?: string;
        correo: string;
    };
    paciente?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
        apMaterno?: string;
        correo: string;
    };
}