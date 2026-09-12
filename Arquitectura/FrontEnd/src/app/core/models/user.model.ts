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

/**
 * Respuesta cruda de login/registro del backend.
 * AuthService.login() lee `response.accessToken || response.token` y
 * `response.user || response`, y Users.establecerSesion() intenta varios
 * nombres de id (`uid`, `idusuario`, `id`, `idUsuario`, `userId`).
 * Por eso se agregan esos alias como opcionales y un índice de respaldo
 * para no romper el build si el backend agrega/renombra campos.
 */
export interface AuthResponse {
    uid?: string;
    idusuario?: number;
    id?: number;
    idUsuario?: number;
    userId?: number;
    nombre?: string;
    apPaterno?: string;
    apMaterno?: string;
    correo?: string;
    rol?: string;
    telefono?: string;
    genero?: string;
    fechaNacimiento?: string;
    curp?: string;
    domicilio?: string;
    codigoPostal?: string;
    localidad?: string;
    municipio?: string;
    estado?: string;
    pinVerificado?: boolean;
    pin?: string;
    /** Nombre usado por AuthService/Users en login normal */
    token?: string;
    /** Nombre usado por AuthService en login/refresh-token */
    accessToken?: string;
    refreshToken?: string;
    /** Algunos endpoints envuelven el usuario real en esta propiedad */
    user?: Partial<AuthResponse>;
    [key: string]: any;
}

/**
 * Payload enviado al backend en login/registro con Google
 * (GoogleService.loginWithGoogle / registerWithGoogle).
 */
export interface GoogleLoginPayload {
    correo: string | null;
    nombre: string;
    apPaterno: string;
    apMaterno: string;
    uid_firebase: string;
    rol: string;
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