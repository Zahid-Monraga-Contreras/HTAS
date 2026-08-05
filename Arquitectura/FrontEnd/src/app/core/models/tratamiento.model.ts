import { Medicamento } from './medicamento.model';
import { Usuario } from './user.model';

export interface Tratamiento {
    idtratamiento: number;
    idpaciente: number;
    iddoctor?: number | null;
    idmedicamento: number;
    dosis: string;
    frecuenciahoras: number;
    fechainicio: string;
    fechafin: string;
    notasinstrucciones?: string;
    activo: boolean;
    created_at: string;
    updated_at: string;
    paciente?: Usuario;
    doctor?: Usuario;
    medicamento?: Medicamento;
}

export interface CrearTratamientoRequest {
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

export interface RegistroToma {
    id?: number;
    idTratamiento: number;
    fechaProgramada: string;
    fechaRealizada?: string;
    estado: 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada' | 'Eliminada';
    notas?: string;
    idAcompanante?: number;
    nombreAcompanante?: string;
}

export interface GenerarTomasRequest {
    idTratamiento: number;
    fechaInicio: string;
    fechaFin: string;
    frecuenciaHoras: number;
}

export interface TomasEstadisticas {
    totalTomas: number;
    tomasCompletadas: number;
    tomasPendientes: number;
    tomasOmitidas: number;
    tomasRetrasadas: number;
    porcentajeCumplimiento: number;
}

export interface TratamientoEstadisticas {
    total: number;
    activos: number;
    inactivos: number;
    porPaciente: Array<{
        idpaciente: number;
        nombre: string;
        total: number;
    }>;
}