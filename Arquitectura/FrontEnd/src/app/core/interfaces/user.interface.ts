/**
 * Interfaces relacionadas con el usuario y la autenticación.
 * Actualizado para reflejar los campos usados en AuthService, GoogleService
 * y Users (services). Reemplaza a la versión anterior, que solo cubría
 * la respuesta "plana" de login.
 */

/** Roles disponibles dentro del sistema */
export type RolUsuario = 'Paciente' | 'Doctor' | 'Acompanante' | 'Admin';

/**
 * Respuesta de login "plana" (se mantiene por retrocompatibilidad
 * con el `user.interface.ts` original). Para el usuario ya procesado
 * en sesión, usar `AuthUser` o `UsuarioSesion`.
 */
export interface User {
    userId: string;
    accessToken: string;
    refreshToken?: string;
    email: string;
    nombres: string;
    apellidos: string;
    tipoUsuario: number;
    expiresIn: number;
    rol: string;
}

/**
 * Usuario autenticado tal como lo maneja `AuthService`.
 * Incluye campos comunes y campos específicos según el rol
 * (paciente, doctor, etc.).
 */
export interface AuthUser {
    idusuario: number;
    uid?: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
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

    pinVerificacion?: string;
    pinVerificado?: boolean;
    token?: string;
    accessToken?: string;
    refreshToken?: string;

    // Datos específicos según rol
    nss?: string;
    tipoSangre?: string;
    cedula?: string;
    especialidad?: string;
    fechaAsignacion?: string;
}

/**
 * Usuario procesado y almacenado en el `Users` service
 * (`currentUserSubject`). Es una versión "aplanada" de `AuthUser`
 * con campos derivados como `nombreCompleto` y `photoURL`.
 */
export interface UsuarioSesion extends Omit<Partial<AuthUser>, 'idusuario' | 'uid'> {
    uid: string | number;
    idusuario: number | null;
    nombre: string;
    nombreCompleto: string;
    rol: string;
    correo: string;
    apPaterno: string;
    apMaterno: string;
    telefono: string;
    photoURL: string;
}

/**
 * Modelo completo de usuario tal como se representa en el backend.
 */
export interface Usuario {
    idusuario: number;
    nombre: string;
    apPaterno: string;
    apMaterno?: string;
    correo: string;
    contrasenia: string;
    telefono?: string;
    genero?: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
    rol: RolUsuario;
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

/**
 * Datos requeridos para registrar un nuevo usuario.
 */
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

/**
 * Payload que se envía al backend en el login/registro con Google
 * (ver `GoogleService.loginWithGoogle` y `registerWithGoogle`).
 */
export interface GoogleLoginPayload {
    correo: string | null;
    nombre: string;
    apPaterno: string;
    apMaterno: string;
    uid_firebase: string;
    rol: string;
}

/**
 * Respuesta del backend al hacer login/registro con Google.
 * `pinVerificado` en false dispara el reenvío de PIN por correo.
 */
export interface GoogleLoginResponse extends Partial<AuthUser> {
    pinVerificado?: boolean;
    pin?: string;
    nombre: string;
}

/** Estado de bloqueo por intentos fallidos de login/PIN */
export interface EstadoBloqueo {
    bloqueado: boolean;
    segundosRestantes: number;
}