import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { tap, catchError } from 'rxjs/operators';
import emailjs from '@emailjs/browser';
import { Observable, throwError } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

// ==========================================================================
// INTERFACES PARA TIPADO
// ==========================================================================
export interface Usuario {
  idusuario: number;
  nombre: string;
  apPaterno: string;
  apMaterno?: string;
  correo: string;
  contrasenia: string;
  telefono?: string;
  genero?: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
  rol: 'Paciente' | 'Doctor' | 'Acompañante' | 'Admin';

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
  fechaNacimiento?: string;  // NUEVO
  curp?: string;            // NUEVO
  domicilio?: string;       // NUEVO
  codigoPostal?: string;    // NUEVO
  localidad?: string;       // NUEVO
  municipio?: string;       // NUEVO
  estado?: string;          // NUEVO
  datosExtra?: any;
  recaptchaToken?: string;
}

export interface MedicionData {
  idPaciente: number;
  sistolica: number;
  diastolica: number;
  pulso: number;
  metodoSincronizacion?: 'Bluetooth' | 'Manual';
  idDispositivo?: number | null;  // NUEVO
  notas?: string;                // NUEVO
}

export interface DispositivoData {
  nombre: string;
  direccionMac: string;
  idPacienteAsociado?: number | null;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class Users {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);

  private apiUrl = `${environment.baseUrl}/api`;

  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  estaBloqueado = signal<boolean>(false);
  segundosRestantes = signal<number>(0);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      emailjs.init('RH7T2EvEV4pbSWkXQ');
    }
  }

  // ==========================================================================
  // --- AUTENTICACIÓN ---
  // ==========================================================================
  registrar(datos: RegistroData) {
    return this.http.post(`${this.apiUrl}/auth/register`, datos).pipe(
      tap((res: any) => {
        this.enviarEmailPin(
          datos.correo,
          datos.nombre || 'Usuario',
          res.pin
        );
      })
    );
  }

  login(credenciales: { correo: string, contrasenia: string }) {
    return this.http.post(`${this.apiUrl}/auth/login`, credenciales).pipe(
      tap((res: any) => {
        this.currentUserSubject.next(res);
        localStorage.setItem('user_htas', JSON.stringify(res));
        if (res.pinVerificado === false) {
          this.establecerSesion(res);
          this.enviarEmailPin(
            credenciales.correo,
            res.nombre || 'Usuario',
            res.pin
          );
        }
      }),
      catchError(err => {
        if (err.status === 423) {
          this.activarContadorVisual(err.error.segundosRestantes);
        }
        return throwError(() => err);
      })
    );
  }

  googleLogin(datos: any) {
    return this.http.post(`${this.apiUrl}/auth/google-login`, datos).pipe(
      tap((res: any) => {
        this.establecerSesion(res);
      })
    );
  }

  establecerSesion(res: any) {
    const usuarioProcesado = {
      ...res,
      uid: res.uid || res.idusuario || res.id,
      nombre: res.nombre,
      rol: res.rol,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(res.nombre)}&background=b0001e&color=fff&bold=true`
    };
    this.currentUserSubject.next(usuarioProcesado);
    localStorage.setItem('user_htas', JSON.stringify(usuarioProcesado));
  }

  cargarSesionPersistente() {
    const saved = localStorage.getItem('user_htas');
    if (saved) {
      this.currentUserSubject.next(JSON.parse(saved));
    }
  }

  limpiarSesion() {
    localStorage.removeItem('user_htas');
    this.currentUserSubject.next(null);
  }

  verificarPin(uid: string, pin: string) {
    return this.http.post(`${this.apiUrl}/auth/verify-pin`, { uid, pin }).pipe(
      catchError(err => {
        if (err.status === 423) {
          this.activarContadorVisual(err.error.segundosRestantes);
        }
        return throwError(() => err);
      })
    );
  }

  private activarContadorVisual(segundos: number) {
    this.estaBloqueado.set(true);
    this.segundosRestantes.set(segundos);
    const intervalo = setInterval(() => {
      this.segundosRestantes.update(s => s - 1);
      if (this.segundosRestantes() <= 0) {
        this.estaBloqueado.set(false);
        clearInterval(intervalo);
      }
    }, 1000);
  }

  solicitarNuevoPin(uid: string) {
    return this.http.post(`${this.apiUrl}/auth/request-new-pin`, { uid }).pipe(
      tap((res: any) => {
        this.enviarEmailPin(res.correo, res.nombre, res.pin);
      })
    );
  }

  private async enviarEmailPin(email: string, nombre: string, pin: string) {
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + 25 * 60000);
    const horaFormateada = expiracion.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const templateParams = {
      pin_seguridad: pin,
      fecha: horaFormateada,
      to_email: email,
      nombre_usuario: nombre
    };

    try {
      await emailjs.send('service_tqqxijq', 'template_a59hcr9', templateParams);
      console.log(`PIN (${pin}) enviado exitosamente a: ${email}`);
    } catch (error) {
      console.error('Error al enviar el PIN con EmailJS:', error);
    }
  }

  // ==========================================================================
  // --- PERFIL DE USUARIO (NUEVOS MÉTODOS) ---
  // ==========================================================================
  getPerfilUsuario(uid: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/perfil/${uid}`);
  }

  actualizarPerfil(uid: string, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/perfil/${uid}`, datos);
  }

  logout(refreshToken: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, { refreshToken });
  }

  refreshToken(refreshToken: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/refresh-token`, { refreshToken });
  }

  // ==========================================================================
  // --- GESTIÓN DE CITAS ---
  // ==========================================================================

  // ✅ CREAR CITA
  crearCita(datosCita: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/citas/agendar-cita`, datosCita);
  }

  // ✅ OBTENER TODAS LAS CITAS
  getAllCitas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/todas-las-citas`);
  }

  // ✅ OBTENER CITAS DE UN USUARIO POR EMAIL
  getMisCitas(email: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/mis-citas/${email}`);
  }

  // ✅ ACTUALIZAR ESTADO DE CITA (solo estado y notas)
  actualizarEstadoCita(idCita: number | string, datos: { estado: string, notasDoctor?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/citas/actualizar-cita/${idCita}`, datos);
  }

  // ✅ OBTENER CITA POR ID
  getCitaById(idCita: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/cita/${idCita}`);
  }

  // ✅ OBTENER CITAS POR FECHA
  getCitasByFecha(fecha: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/citas/fecha/${fecha}`);
  }

  // ✅ OBTENER CITAS DE HOY
  getCitasHoy(): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/citas/hoy`);
  }

  // ✅ ACTUALIZAR CITA COMPLETA (todos los campos)
  actualizarCita(idCita: number | string, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/citas/cita/${idCita}`, datos);
  }

  // ✅ CANCELAR CITA
  cancelarCita(idCita: number | string, motivoCancelacion?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/citas/cita/${idCita}/cancelar`, { motivoCancelacion });
  }

  // ✅ OBTENER ESTADÍSTICAS DE CITAS
  getEstadisticasCitas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/citas/estadisticas`);
  }

  // ✅ ELIMINAR CITA
  eliminarCita(idCita: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/citas/cita/${idCita}`);
  }

  // ✅ NUEVO: OBTENER HISTORIAL DE CAMBIOS DE UNA CITA
  getHistorialCita(idCita: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/cita/${idCita}/historial`);
  }

  // ✅ NUEVO: GUARDAR HISTORIAL DE CAMBIOS
  guardarHistorialCita(data: {
    idCita: number | string;
    accion: string;
    detalle: string;
    usuario?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/citas/cita/historial`, data);
  }

  // ==========================================================================
  // --- GESTIÓN DE USUARIOS ---
  // ==========================================================================
  getUsuariosBackend(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios/all-users`);
  }

  getRegistrosUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios/all-users`);
  }

  getUsuarioById(id: string | number): Observable<any> {
    return this.http.get(`${this.apiUrl}/usuarios/usuario/${id}`);
  }

  updateUsuario(id: string | number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/usuarios/update-user/${id}`, datos);
  }

  deleteUsuario(id: string | number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/usuarios/delete-user/${id}`);
  }

  crearUsuario(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/usuarios/crear-usuario`, datos);
  }

  // ==========================================================================
  // --- GESTIÓN DE MEDICAMENTOS ---
  // ==========================================================================
  getMedicamentos(params?: { busqueda?: string; laboratorio?: string }): Observable<any[]> {
    let url = `${this.apiUrl}/medicamentos/medicamentos`;
    const queryParams = [];
    if (params?.busqueda) queryParams.push(`busqueda=${encodeURIComponent(params.busqueda)}`);
    if (params?.laboratorio) queryParams.push(`laboratorio=${encodeURIComponent(params.laboratorio)}`);
    if (queryParams.length) url += `?${queryParams.join('&')}`;
    return this.http.get<any[]>(url);
  }

  getMedicamentoById(id: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/medicamentos/medicamento/${id}`);
  }

  crearMedicamento(datos: {
    nombreComercial: string;
    sustanciaActiva?: string;
    presentacion: string;
    concentracion?: string;
    laboratorio?: string;
    indicacionesGenerales?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/medicamentos/medicamentos`, datos);
  }

  actualizarMedicamento(id: string | number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/medicamentos/medicamentos/${id}`, datos);
  }

  actualizarParcialMedicamento(id: string | number, datos: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/medicamentos/medicamento/${id}`, datos);
  }

  eliminarMedicamento(id: string | number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/medicamentos/medicamentos/${id}`);
  }

  buscarMedicamentos(termino: string, limite?: number): Observable<any[]> {
    let url = `${this.apiUrl}/medicamentos/medicamentos/buscar?termino=${encodeURIComponent(termino)}`;
    if (limite) url += `&limite=${limite}`;
    return this.http.get<any[]>(url);
  }

  getMedicamentosMasRecetados(limite?: number): Observable<any[]> {
    let url = `${this.apiUrl}/medicamentos/medicamentos/mas-recetados`;
    if (limite) url += `?limite=${limite}`;
    return this.http.get<any[]>(url);
  }

  getEstadisticasMedicamentos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/medicamentos/medicamentos/estadisticas`);
  }

  // ✅ OBTENER ESTADÍSTICAS DE UN MEDICAMENTO ESPECÍFICO 
  getEstadisticasMedicamento(idMedicamento: number | string): Observable<any> {
    return this.http.get(` ${this.apiUrl} /medicamentos/medicamento/ ${idMedicamento} /estadisticas `);
  }

  // ==========================================================================
  // --- GESTIÓN DE TRATAMIENTOS ---
  // ==========================================================================
  getTratamientos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tratamientos/tratamientos`);
  }

  getTratamientoById(id: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/tratamientos/tratamiento/${id}`);
  }

  getTratamientosByPaciente(idPaciente: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tratamientos/paciente/${idPaciente}/tratamientos`);
  }

  getTratamientosActivosByPaciente(idPaciente: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tratamientos/paciente/${idPaciente}/tratamientos/activos`);
  }

  crearTratamiento(datos: {
    idPaciente: number;
    idDoctor?: number | null;
    idMedicamento: number;
    dosis: string;
    frecuenciaHoras: number;
    fechaInicio: string;
    fechaFin: string;
    notasInstrucciones?: string;
    activo?: boolean;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/tratamientos/tratamientos`, datos);
  }

  actualizarTratamiento(id: string | number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/tratamientos/tratamientos/${id}`, datos);
  }

  toggleEstadoTratamiento(id: string | number, activo: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/tratamientos/tratamiento/${id}/estado`, { activo });
  }

  eliminarTratamiento(id: string | number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/tratamientos/tratamientos/${id}`);
  }

  getEstadisticasTratamientos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/tratamientos/estadisticas-tratamientos`);
  }

  // ==========================================================================
  // --- GESTIÓN DE DISPOSITIVOS ---
  // ==========================================================================
  getDispositivos(params?: {
    paciente?: number;
    activo?: boolean;
    busqueda?: string;
  }): Observable<any[]> {
    let url = `${this.apiUrl}/dispositivos/dispositivos`;
    const queryParams = [];
    if (params?.paciente) queryParams.push(`paciente=${params.paciente}`);
    if (params?.activo !== undefined) queryParams.push(`activo=${params.activo}`);
    if (params?.busqueda) queryParams.push(`busqueda=${encodeURIComponent(params.busqueda)}`);
    if (queryParams.length) url += `?${queryParams.join('&')}`;
    return this.http.get<any[]>(url);
  }

  getDispositivoById(id: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/dispositivos/dispositivo/${id}`);
  }

  getDispositivosByPaciente(idPaciente: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/dispositivos/paciente/${idPaciente}/dispositivos`);
  }

  crearDispositivo(datos: DispositivoData): Observable<any> {
    return this.http.post(`${this.apiUrl}/dispositivos/dispositivos`, datos);
  }

  actualizarDispositivo(id: string | number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/dispositivos/dispositivos/${id}`, datos);
  }

  desactivarDispositivo(id: string | number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/dispositivos/dispositivo/${id}/desactivar`, {});
  }

  activarDispositivo(id: string | number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/dispositivos/dispositivo/${id}/activar`, {});
  }

  sincronizarDispositivo(id: string | number): Observable<any> {
    return this.http.post(`${this.apiUrl}/dispositivos/dispositivo/${id}/sincronizar`, {});
  }

  eliminarDispositivo(id: string | number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/dispositivos/dispositivos/${id}`);
  }

  getEstadisticasDispositivos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dispositivos/dispositivos/estadisticas`);
  }

  // ==========================================================================
  // --- GESTIÓN DE MEDICIONES (ACTUALIZADO) ---
  // ==========================================================================
  registrarMedicion(datos: MedicionData): Observable<any> {
    return this.http.post(`${this.apiUrl}/mediciones`, datos);
  }

  getMedicionesPaciente(
    idPaciente: number | string,
    limite?: number,
    orden?: string
  ): Observable<any> {
    let url = `${this.apiUrl}/mediciones/paciente/${idPaciente}`;
    const params = [];
    if (limite) params.push(`limite=${limite}`);
    if (orden) params.push(`orden=${orden}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  getUltimaMedicionPaciente(idPaciente: number | string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mediciones/paciente/${idPaciente}/ultima`);
  }

  getMedicionesPorRango(
    idPaciente: number | string,
    fechaInicio: string,
    fechaFin: string
  ): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/mediciones/paciente/${idPaciente}/rango?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
    );
  }

  getEstadisticasMediciones(
    idPaciente: number | string,
    periodo?: 'dia' | 'semana' | 'mes' | 'trimestre'
  ): Observable<any> {
    let url = `${this.apiUrl}/mediciones/paciente/${idPaciente}/estadisticas`;
    if (periodo) url += `?periodo=${periodo}`;
    return this.http.get(url);
  }

  eliminarMedicion(idMedicion: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mediciones/medicion/${idMedicion}`);
  }

  registrarMultiplesMediciones(mediciones: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/mediciones/registrar-multiples`, { mediciones });
  }

  // ==========================================================================
  // --- NOTIFICACIONES ---
  // ==========================================================================
  getAlertasMedicas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/auth/notificaciones-medico`);
  }

  getNotificacionesPaciente(email: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/auth/notificaciones-paciente/${email}`);
  }

  getNotificacionesAcompanante(idUsuario: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/auth/notificaciones-acompanante/${idUsuario}`);
  }
}