export interface Cita {
    idcita: number;
    nombrepaciente: string;
    appaternopaciente: string;
    apmaternopaciente?: string;
    telefonopaciente?: string;
    correopaciente?: string;
    fechacita: string;
    horacita: string;
    motivo?: string;
    sintomas?: string;
    estado: 'Programada' | 'Confirmada' | 'Completada' | 'Cancelada' | 'No Asistió';
    modalidad: 'Presencial' | 'Virtual';
    notasdoctor?: string;
    fechacancelacion?: string;
    created_at: string;
    updated_at: string;
    categoriafecha?: 'Vencida' | 'Hoy' | 'Mañana' | 'Futura';
    prioridad?: 'Atención Urgente' | 'Normal';
    estadotiempo?: 'Pasada' | 'Pendiente';
}

export interface CrearCitaRequest {
    nombrePaciente: string;
    apPaternoPaciente: string;
    apMaternoPaciente?: string;
    telefonoPaciente?: string;
    correoPaciente?: string;
    fechaCita: string;
    horaCita: string;
    motivo?: string;
    modalidad?: string;
    sintomas?: string;
    idUsuarioPaciente?: number | null;
}

export interface ActualizarCitaRequest {
    nombrePaciente?: string;
    apPaternoPaciente?: string;
    apMaternoPaciente?: string;
    telefonoPaciente?: string;
    correoPaciente?: string;
    fechaCita?: string;
    horaCita?: string;
    motivo?: string;
    modalidad?: string;
    sintomas?: string;
    notasDoctor?: string;
}

export interface ActualizarEstadoCitaRequest {
    estado: string;
    notasDoctor?: string;
}

export interface CancelarCitaRequest {
    motivoCancelacion?: string;
}

export interface DisponibilidadResponse {
    disponible: boolean;
    mensaje: string;
    detalles: {
        totalCitasEnHora: number;
        maximoPermitido: number;
        horaLlena: boolean;
        cuposDisponibles: number;
        usuarioYaTieneCita?: boolean;
        citasHoy?: number;
        limiteDiaAlcanzado?: boolean;
        maximoPorDia?: number;
    };
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

export interface CitaEstadisticas {
    totalcitas: number;
    programadas: number;
    confirmadas: number;
    completadas: number;
    canceladas: number;
    noasistio: number;
    presenciales: number;
    virtuales: number;
    citasfuturas: number;
    citasvencidas: number;
}

export interface ResumenAdminResponse {
    total: number;
    programadas: number;
    confirmadas: number;
    completadas: number;
    canceladas: number;
    no_asistio: number;
    proximas: number;
    vencidas: number;
}

export interface CuposPorHoraResponse {
    fecha: string;
    horarios: Array<{
        horacita: string;
        total: number;
        cupos_disponibles: number;
        estados: string[];
    }>;
    total_horarios: number;
}

export interface HistorialCita {
    id: number;
    idCita: number;
    accion: string;
    detalle: string;
    usuario?: string;
    fecha: string;
}

export interface CitaFiltros {
    fecha?: string;
    estado?: string;
    modalidad?: string;
    busqueda?: string;
    fechaInicio?: string;
    fechaFin?: string;
    soloFuturas?: boolean;
}