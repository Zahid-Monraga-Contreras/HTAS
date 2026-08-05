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