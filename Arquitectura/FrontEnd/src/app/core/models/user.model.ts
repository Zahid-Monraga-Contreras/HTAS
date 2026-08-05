export interface Usuario {
    idusuario: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    contrasenia: string;
    telefono?: string;
    genero?: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
    rol: 'Paciente' | 'Doctor' | 'Acompanante' | 'Admin';
    fechaNacimiento?: string;
    curp?: string;
    domicilio?: string;
    codigoPostal?: string;
    localidad?: string;
    municipio?: string;
    estado?: string;
    pinVerificacion?: string;
    pinVerificado?: boolean;
    intentosFallidos?: number;
    bloqueadoHasta?: string;
    activo?: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
    googlefittoken?: any;
}

export interface RegistroData {
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    contrasenia: string;
    rol: string;
    telefono?: string;
    genero?: string;
    fechaNacimiento?: string;
    curp?: string;
    domicilio?: string;
    codigoPostal?: string;
    localidad?: string;
    municipio?: string;
    estado?: string;
    datosExtra?: any;
    recaptchaToken?: string;
}

export interface LoginCredentials {
    correo: string;
    contrasenia: string;
}

export interface AuthResponse {
    uid?: string;
    idusuario?: number;
    nombre?: string;
    apPaterno?: string;
    apMaterno?: string;
    correo?: string;
    rol?: string;
    telefono?: string;
    pinVerificado?: boolean;
    pin?: string;
    token?: string;
    refreshToken?: string;
}

export interface PerfilUsuario {
    idusuario: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    telefono?: string;
    genero?: string;
    fechaNacimiento?: string;
    curp?: string;
    domicilio?: string;
    codigoPostal?: string;
    localidad?: string;
    municipio?: string;
    estado?: string;
    rol: string;
    activo: boolean;
    created_at: string;
    updated_at: string;
}

export interface PinVerificationRequest {
    uid: string;
    pin: string;
}

export interface PinVerificationResponse {
    success: boolean;
    message: string;
    pinVerificado: boolean;
    segundosRestantes?: number;
}