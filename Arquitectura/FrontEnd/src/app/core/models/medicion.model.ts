export interface Medicion {
    idmedicion: number;
    idpaciente: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    metodoregistro: 'Manual' | 'Bluetooth';
    iddispositivo?: number | null;
    fecha: string;
    created_at: string;
}

export interface MedicionData {
    idPaciente: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    metodoSincronizacion?: 'Bluetooth' | 'Manual';
    idDispositivo?: number | null;
    notas?: string;
}

export interface MedicionEstadisticas {
    promedioSistolica: number;
    promedioDiastolica: number;
    promedioPulso: number;
    maxSistolica: number;
    minSistolica: number;
    maxDiastolica: number;
    minDiastolica: number;
    totalMediciones: number;
    medicionesPorDia: Array<{
        fecha: string;
        total: number;
    }>;
    clasificacion: 'Normal' | 'Elevada' | 'Hipertension' | 'Crisis';
}

export interface MedicionRango {
    fechaInicio: string;
    fechaFin: string;
    mediciones: Medicion[];
}

/**
 * Última medición obtenida directamente del tensiómetro Bluetooth
 * vinculado al paciente. Corresponde a
 * Users.obtenerMedicionTensiometro(idPaciente), que antes devolvía
 * `any`. Ajustar campos según la forma real de respuesta del backend.
 */
export interface MedicionTensiometro {
    conectado: boolean;
    sistolica?: number;
    diastolica?: number;
    pulso?: number;
    iddispositivo?: number;
    timestamp?: string;
    mensaje?: string;
}