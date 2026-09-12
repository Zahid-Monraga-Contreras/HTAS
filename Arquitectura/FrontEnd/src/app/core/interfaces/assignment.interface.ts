/**
 * Interfaces relacionadas con la asignación de pacientes a doctores.
 * Consolidado a partir de Users (métodos de asignaciones).
 */

export interface Asignacion {
    idAsignacion: number;
    idPaciente: number;
    idDoctor: number;
    asignadoPor?: number;
    notas?: string;
    activo?: boolean;
    created_at?: string;
}

/** Datos requeridos para asignar un paciente a un doctor */
export interface AsignarPacienteData {
    idPaciente: number;
    idDoctor: number;
    asignadoPor?: number;
    notas?: string;
}

/** Datos requeridos para asignar múltiples pacientes a un doctor */
export interface AsignarMultiplesPacientesData {
    idDoctor: number;
    pacientesIds: number[];
    asignadoPor?: number;
    notas?: string;
}

export interface EstadisticasAsignaciones {
    totalAsignaciones: number;
    pacientesSinAsignar: number;
    doctoresConPacientes: number;
    [key: string]: any;
}

/** Doctor con información completa (usado en listados de asignación) */
export interface DoctorCompleto {
    idusuario: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    cedula?: string;
    especialidad?: string;
    totalPacientes?: number;
}

/** Paciente con información completa (usado en listados de asignación) */
export interface PacienteCompleto {
    idusuario: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    nss?: string;
    tipoSangre?: string;
    idDoctorAsignado?: number | null;
}