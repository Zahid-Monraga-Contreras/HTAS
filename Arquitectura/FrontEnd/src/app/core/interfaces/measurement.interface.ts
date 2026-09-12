/**
 * Interfaces relacionadas con las mediciones de presión arterial.
 * Consolidado a partir de Users (métodos de mediciones).
 */

export type MetodoSincronizacion = 'Bluetooth' | 'Manual';

export interface Medicion {
    idMedicion: number;
    idPaciente: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    metodoSincronizacion: MetodoSincronizacion;
    idDispositivo?: number | null;
    notas?: string;
    fecha_registro?: string;
}

/** Datos requeridos para registrar una medición */
export interface MedicionData {
    idPaciente: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    metodoSincronizacion?: MetodoSincronizacion;
    idDispositivo?: number | null;
    notas?: string;
}

export type PeriodoEstadisticas = 'dia' | 'semana' | 'mes' | 'trimestre';

export interface EstadisticasMediciones {
    promedioSistolica?: number;
    promedioDiastolica?: number;
    promedioPulso?: number;
    totalMediciones?: number;
    periodo?: PeriodoEstadisticas;
    [key: string]: any;
}