import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

// ==========================================================================
// INTERFACES PARA TIPADO
// ==========================================================================
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

  // NUEVOS CAMPOS
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.baseUrl}/api/auth`;
  private currentUser = new BehaviorSubject<AuthUser | null>(null);
  private authToken: string | null = null;
  private refreshTokenValue: string | null = null; // ✅ CAMBIADO: rename para evitar conflicto

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      // Cargar tokens
      this.authToken = localStorage.getItem('access_token') || localStorage.getItem('token');
      this.refreshTokenValue = localStorage.getItem('refresh_token');

      // Cargar usuario (intentar con ambas keys)
      const savedUser = localStorage.getItem('user_data') || localStorage.getItem('user');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          this.currentUser.next(userData);
        } catch (e) {
          console.error('Error al parsear usuario guardado:', e);
          this.limpiarSesion();
        }
      }
    }
  }

  // ==========================================================================
  // --- AUTENTICACIÓN ---
  // ==========================================================================

  /**
   * Login con correo y contraseña
   * @param correo - Email del usuario
   * @param contrasenia - Contraseña del usuario
   */
  login(correo: string, contrasenia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, {
      correo,
      contrasenia
    }).pipe(
      tap((response: any) => {
        // Manejar diferentes formatos de respuesta
        const token = response.accessToken || response.token;
        const user = response.user || response;

        if (token) {
          this.authToken = token;
          this.refreshTokenValue = response.refreshToken || null;

          // Procesar usuario
          const usuarioProcesado: AuthUser = {
            ...user,
            uid: user.uid || user.idusuario || user.id,
            token: token,
            refreshToken: this.refreshTokenValue || undefined
          };

          this.currentUser.next(usuarioProcesado);

          // Guardar en localStorage
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('access_token', token);
            localStorage.setItem('token', token); // Compatibilidad
            if (this.refreshTokenValue) {
              localStorage.setItem('refresh_token', this.refreshTokenValue);
            }
            localStorage.setItem('user_data', JSON.stringify(usuarioProcesado));
            localStorage.setItem('user', JSON.stringify(usuarioProcesado)); // Compatibilidad
          }
        }
      })
    );
  }

  /**
   * Registro de nuevo usuario
   */
  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  /**
   * Google Login
   */
  googleLogin(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/google-login`, datos).pipe(
      tap((response: any) => {
        const token = response.accessToken || response.token;
        const user = response.user || response;

        if (token) {
          this.authToken = token;
          const usuarioProcesado: AuthUser = {
            ...user,
            uid: user.uid || user.idusuario || user.id,
            token: token
          };

          this.currentUser.next(usuarioProcesado);

          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('access_token', token);
            localStorage.setItem('token', token);
            localStorage.setItem('user_data', JSON.stringify(usuarioProcesado));
            localStorage.setItem('user', JSON.stringify(usuarioProcesado));
          }
        }
      })
    );
  }

  // ==========================================================================
  // --- VERIFICACIÓN DE PIN ---
  // ==========================================================================

  verificarPin(uid: string, pin: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-pin`, { uid, pin });
  }

  solicitarNuevoPin(uid: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request-new-pin`, { uid });
  }

  // ==========================================================================
  // --- PERFIL ---
  // ==========================================================================

  /**
   * Obtener perfil completo del usuario
   */
  getPerfil(uid: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/perfil/${uid}`);
  }

  /**
   * Actualizar perfil del usuario
   */
  actualizarPerfil(uid: string, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/perfil/${uid}`, datos).pipe(
      tap((response: any) => {
        // Actualizar usuario en localStorage si es el mismo
        const currentUser = this.currentUser.value;
        // ✅ CORREGIDO: Convertir uid a string para comparar
        if (currentUser && String(currentUser.uid) === String(uid)) {
          const usuarioActualizado = {
            ...currentUser,
            ...response,
            ...datos
          };
          this.currentUser.next(usuarioActualizado);
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('user_data', JSON.stringify(usuarioActualizado));
            localStorage.setItem('user', JSON.stringify(usuarioActualizado));
          }
        }
      })
    );
  }

  // ==========================================================================
  // --- TOKENS ---
  // ==========================================================================

  /**
   * Refrescar token de acceso
   */
  refreshAccessToken(): Observable<any> { // ✅ CAMBIADO: rename para evitar conflicto
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No hay refresh token disponible');
    }

    return this.http.post(`${this.apiUrl}/refresh-token`, { refreshToken }).pipe(
      tap((response: any) => {
        if (response.accessToken) {
          this.authToken = response.accessToken;
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('access_token', response.accessToken);
            localStorage.setItem('token', response.accessToken);
          }
        }
      })
    );
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken }).subscribe({
        next: () => {
          this.limpiarSesion();
          this.router.navigate(['/login']);
        },
        error: () => {
          // Si falla, limpiar sesión de todas formas
          this.limpiarSesion();
          this.router.navigate(['/login']);
        }
      });
    } else {
      this.limpiarSesion();
      this.router.navigate(['/login']);
    }
  }

  private limpiarSesion(): void {
    this.authToken = null;
    this.refreshTokenValue = null;
    this.currentUser.next(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user');
    }
  }

  // ==========================================================================
  // --- GETTERS ---
  // ==========================================================================

  getToken(): string | null {
    return this.authToken || localStorage.getItem('access_token') || localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return this.refreshTokenValue || (isPlatformBrowser(this.platformId) ? localStorage.getItem('refresh_token') : null);
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null && this.currentUser.value !== null;
  }

  getUser(): AuthUser | null {
    return this.currentUser.value;
  }

  getUserRole(): string {
    const user = this.getUser();
    return user?.rol ? user.rol.toLowerCase() : 'paciente';
  }

  getUserFullName(): string {
    const user = this.getUser();
    if (!user) return 'Usuario';
    return `${user.nombre} ${user.apPaterno}${user.apMaterno ? ' ' + user.apMaterno : ''}`;
  }

  // ==========================================================================
  // --- NUEVOS GETTERS PARA CAMPOS ADICIONALES ---
  // ==========================================================================

  getFechaNacimiento(): string | undefined {
    return this.currentUser.value?.fechaNacimiento;
  }

  getCURP(): string | undefined {
    return this.currentUser.value?.curp;
  }

  getDomicilio(): string | undefined {
    return this.currentUser.value?.domicilio;
  }

  getUbicacion(): string | undefined {
    const user = this.currentUser.value;
    if (!user) return undefined;
    const partes = [user.localidad, user.municipio, user.estado].filter(Boolean);
    return partes.length ? partes.join(', ') : undefined;
  }

  getCodigoPostal(): string | undefined {
    return this.currentUser.value?.codigoPostal;
  }

  isPinVerificado(): boolean {
    return this.currentUser.value?.pinVerificado || false;
  }

  // ==========================================================================
  // --- MÉTODOS DE COMPATIBILIDAD CON USERS SERVICE ---
  // ==========================================================================

  /**
   * Establecer sesión desde Users service (para compatibilidad)
   */
  establecerSesion(res: any): void {
    const usuarioProcesado: AuthUser = {
      ...res,
      uid: res.uid || res.idusuario || res.id,
      token: res.accessToken || res.token
    };

    this.currentUser.next(usuarioProcesado);
    if (isPlatformBrowser(this.platformId)) {
      if (usuarioProcesado.token) {
        localStorage.setItem('access_token', usuarioProcesado.token);
        localStorage.setItem('token', usuarioProcesado.token);
      }
      if (res.refreshToken) {
        localStorage.setItem('refresh_token', res.refreshToken);
      }
      localStorage.setItem('user_data', JSON.stringify(usuarioProcesado));
      localStorage.setItem('user', JSON.stringify(usuarioProcesado));
    }
  }

  /**
   * Obtener usuario como el formato que espera Users service
   */
  getUsuarioFormatoUsers(): any {
    const user = this.currentUser.value;
    if (!user) return null;

    return {
      ...user,
      idusuario: user.uid || user.idusuario,
      uid: user.uid || user.idusuario,
      appaterno: user.apPaterno,
      apmaterno: user.apMaterno,
      pinverificacion: user.pinVerificacion,
      pinverificado: user.pinVerificado
    };
  }

  /**
   * Sincronizar con el estado de Users service
   */
  sincronizarConUsers(usersService: any): void {
    usersService.currentUser$.subscribe((user: any) => {
      if (user) {
        this.establecerSesion(user);
      } else {
        this.limpiarSesion();
      }
    });
  }
}