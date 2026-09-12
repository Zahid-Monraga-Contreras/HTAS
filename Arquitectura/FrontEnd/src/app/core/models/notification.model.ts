export interface Notificacion {
    idnotificacion: number;
    idusuario: number;
    titulo: string;
    mensaje: string;
    tipo: 'Info' | 'Advertencia' | 'Urgente' | 'Recordatorio';
    leida: boolean;
    fecha: string;
    created_at: string;
    updated_at: string;
    usuario?: {
        idusuario: number;
        nombre: string;
        apPaterno: string;
    };
}

export interface NotificacionRequest {
    idUsuario: number;
    titulo: string;
    mensaje: string;
    tipo: string;
}

/**
 * Alerta médica dirigida a un doctor sobre un paciente
 * (Users.getAlertasMedicas). Antes no tenía tipo propio (se usaba
 * `any[]`). Ajustar campos según la forma real de respuesta del backend.
 */
export interface AlertaMedica {
    idalerta?: number;
    idpaciente: number;
    nombrepaciente?: string;
    tipo: string;
    mensaje: string;
    nivelurgencia?: 'Baja' | 'Media' | 'Alta' | 'Critica';
    fecha: string;
    atendida?: boolean;
}