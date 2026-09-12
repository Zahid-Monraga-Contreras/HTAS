// ==========================================================================
// SOLICITUDES DE ASIGNACIÓN (acompañante -> paciente)
// ==========================================================================

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

/** Vínculo acompañante-paciente ya aprobado, generado a partir de una Solicitud. */
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

// ==========================================================================
// ASIGNACIONES PACIENTE -> DOCTOR
// (Users: getAllAsignaciones, asignarPacienteADoctor, getDoctoresCompletos,
// getPacientesDeDoctor, desasignarPacienteDeDoctor, etc.)
// Es un dominio DISTINTO al de acompañante-paciente de arriba;
// no existía ningún tipo para él en la versión anterior del modelo.
// ==========================================================================

/** Vínculo directo entre un paciente y su doctor tratante. */
export interface AsignacionDoctorPaciente {
    idasignacion: number;
    idpaciente: number;
    iddoctor: number;
    asignadopor?: number | null;
    notas?: string;
    activo: boolean;
    created_at: string;
    updated_at?: string;
}

export interface AsignarPacienteRequest {
    idPaciente: number;
    idDoctor: number;
    asignadoPor?: number;
    notas?: string;
}

export interface AsignarMultiplesPacientesRequest {
    idDoctor: number;
    pacientesIds: number[];
    asignadoPor?: number;
    notas?: string;
}

export interface EstadisticasAsignaciones {
    totalAsignaciones: number;
    pacientesSinAsignar: number;
    doctoresConPacientes: number;
}

/** Doctor con información completa, usado en listados de asignación. */
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

/** Paciente con información completa, usado en listados de asignación. */
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

export interface DoctorDePacienteResponse {
    idpaciente: number;
    doctor: DoctorCompleto | null;
}

export interface VerificarPacienteAsignadoResponse {
    asignado: boolean;
    doctor?: DoctorCompleto;
}