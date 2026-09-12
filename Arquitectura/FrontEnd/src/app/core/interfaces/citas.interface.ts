/**
 * Interfaces relacionadas con la gestión de citas médicas,
 * su disponibilidad y su administración.
 * Consolidado a partir de Users (services/users.ts).
 */

export type EstadoCita =
    | 'Programada'
    | 'Confirmada'
    | 'Completada'
    | 'Cancelada'
    | 'No asistio';

/** Modelo genérico de una cita (ajustar según respuesta real del backend) */
export interface Cita {
    idCita: number;
    idPaciente?: number;
    idDoctor?: number;
    correo?: string;
    fecha: string;
    hora: string;
    estado: EstadoCita | string;
    esVirtual?: boolean;
    notasDoctor?: string;
    motivoCancelacion?: string;
    created_at?: string;
    updated_at?: string;
}

/** Historial de cambios de una cita */
export interface HistorialCitaEntry {
    id?: number;
    idCita: number;
    accion: string;
    detalle: string;
    usuario?: string;
    fecha?: string;
}

// ==========================================================================
// DISPONIBILIDAD DE CITAS
// ==========================================================================

export interface DisponibilidadDetalles {
    totalCitasEnHora: number;
    maximoPermitido: number;
    horaLlena: boolean;
    cuposDisponibles: number;
    yaAgendado: boolean;
    correoExistente?: string | null;
    usuarioYaTieneCita?: boolean;
    citasHoy?: number;
    limiteDiaAlcanzado?: boolean;
    maximoPorDia?: number;
}

export interface DisponibilidadResponse {
    disponible: boolean;
    mensaje: string;
    detalles: DisponibilidadDetalles;
}

export interface HorarioDisponible {
    horacita: string;
    total: number;
    disponibilidad: string;
    cupos: number;
}

export interface HorariosDisponiblesResponse {
    success: boolean;
    fecha: string;
    horariosDisponibles: string[];
    horariosCompletos: string[];
    horariosUsuario: string[];
    horariosOcupados?: {
        [key: string]: {
            ocupado: boolean;
            por: string;
        };
    };
    citasUsuario: any[];
    totalDisponibles: number;
    totalHorarios: number;
    mensaje: string;
}

export interface CitasDisponiblesHoyResponse {
    fecha: string;
    horarios: HorarioDisponible[];
    totalHorarios: number;
    horariosDisponibles: number;
}

export interface ProximasCitasResponse {
    success: boolean;
    citas: Cita[];
    total: number;
}

export interface HistorialCitasResponse {
    success: boolean;
    citas: Cita[];
    total: number;
    limite: number;
    offset: number;
    totalPaginas: number;
}

// ==========================================================================
// DISPONIBILIDAD MASIVA (verificación por lote)
// ==========================================================================

export interface DisponibilidadMasivaItem {
    fecha: string;
    hora: string;
    email?: string;
}

export interface DisponibilidadMasivaDetalles {
    yaAgendado: boolean;
    correoExistente: string | null;
    horaLlena: boolean;
    usuarioYaTieneCita: boolean;
}

export interface DisponibilidadMasivaResultado {
    fecha: string;
    hora: string;
    email: string | null;
    disponible: boolean;
    mensaje: string;
    detalles?: DisponibilidadMasivaDetalles;
}

export interface DisponibilidadMasivaResponse {
    success: boolean;
    total: number;
    resultados: DisponibilidadMasivaResultado[];
}

// ==========================================================================
// ADMINISTRACIÓN DE CITAS
// ==========================================================================

export interface ResumenAdminResponse {
    total: number;
    programadas: number;
    confirmadas: number;
    completadas: number;
    canceladas: number;
    no_asistio: number;
    proximas: number;
    vencidas: number;
    presenciales: number;
    virtuales: number;
}

export interface CupoPorHora {
    horacita: string;
    total: number;
    cupos_disponibles: number;
    estados: string[];
    correos: string[];
}

export interface CuposPorHoraResponse {
    fecha: string;
    horarios: CupoPorHora[];
    total_horarios: number;
    horarios_disponibles: number;
}