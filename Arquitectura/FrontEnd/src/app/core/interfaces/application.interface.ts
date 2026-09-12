/**
 * Interfaces relacionadas con las solicitudes de asignación
 * entre un acompañante y un paciente.
 * Consolidado a partir de Users (métodos de solicitudes).
 */

export type EstadoSolicitud = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface Solicitud {
    idSolicitud: number;
    idAcompanante: number;
    correoPaciente: string;
    parentesco: string;
    notas: string;
    estado: EstadoSolicitud;
    idAdmin?: number;
    motivoRechazo?: string;
    created_at?: string;
    updated_at?: string;
}

/** Datos requeridos para solicitar la asignación de un paciente */
export interface SolicitarAsignacionData {
    correoPaciente: string;
    parentesco: string;
    notas: string;
}

export interface PacienteAsignado {
    idPaciente: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    parentesco?: string;
    fechaAsignacion?: string;
}