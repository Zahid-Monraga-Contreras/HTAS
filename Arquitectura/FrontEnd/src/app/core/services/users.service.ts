import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { tap, catchError, map } from 'rxjs/operators';
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

export interface MedicionData {
  idPaciente: number;
  sistolica: number;
  diastolica: number;
  pulso: number;
  metodoSincronizacion?: 'Bluetooth' | 'Manual';
  idDispositivo?: number | null;
  notas?: string;
}

export interface DispositivoData {
  nombre: string;
  direccionMac: string;
  idPacienteAsociado?: number | null;
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

// ==========================================================================
// INTERFACES PARA DISPONIBILIDAD DE CITAS (ACTUALIZADAS)
// ==========================================================================
export interface DisponibilidadResponse {
  disponible: boolean;
  mensaje: string;
  detalles: {
    totalCitasEnHora: number;
    maximoPermitido: number;
    horaLlena: boolean;
    cuposDisponibles: number;
    yaAgendado: boolean;
    correoExistente?: string | null;
    usuarioYaTieneCita?: boolean;
    citasHoy?: number;
    limiteDiaAlcanzado?: boolean;
    maximoPorDia?: number;
  };
}

export interface HorarioDisponible {
  horacita: string;
  total: number;
  disponibilidad: string;
  cupos: number;
}

export interface HorariosDisponiblesResponse {
  success: boolean;
  fecha: string;
  horariosDisponibles: string[];
  horariosCompletos: string[];
  horariosUsuario: string[];
  horariosOcupados?: {
    [key: string]: {
      ocupado: boolean;
      por: string;
    };
  };
  citasUsuario: any[];
  totalDisponibles: number;
  totalHorarios: number;
  mensaje: string;
}

export interface CitasDisponiblesHoyResponse {
  fecha: string;
  horarios: HorarioDisponible[];
  totalHorarios: number;
  horariosDisponibles: number;
}

// ==========================================================================
// INTERFACES PARA DISPONIBILIDAD MASIVA
// ==========================================================================
export interface DisponibilidadMasivaItem {
  fecha: string;
  hora: string;
  email?: string;
}

export interface DisponibilidadMasivaResultado {
  fecha: string;
  hora: string;
  email: string | null;
  disponible: boolean;
  mensaje: string;
  detalles?: {
    yaAgendado: boolean;
    correoExistente: string | null;
    horaLlena: boolean;
    usuarioYaTieneCita: boolean;
  };
}

export interface DisponibilidadMasivaResponse {
  success: boolean;
  total: number;
  resultados: DisponibilidadMasivaResultado[];
}

// ==========================================================================
// INTERFACES PARA EL ALGORITMO
// ==========================================================================
export interface AnalisisRequest {
  edad: number;
  sistolica: number;
  diastolica: number;
  tomaMedicamento: number;
  cedulaMedico?: string;
  idPaciente: number;
  idDoctor?: number;
  pdf: File;
}

export interface AnalisisCompletoRequest {
  edad: number;
  sistolica: number;
  diastolica: number;
  tomaMedicamento: number;
  cedulaMedico?: string;
  idPaciente: number;
  idDoctor?: number;
  cedula: File;
  diagnostico: File;
}

export interface AnalisisResponse {
  success: boolean;
  data: {
    exitoso: boolean;
    folio_expediente_db: number;
    cedula_pdf_valida: boolean;
    diagnostico_pdf_valido: boolean;
    prediccion_crisis: number;
    probabilidad_porcentual: number;
    nivel_riesgo_clinico: string;
    protocolo_sugerido: string;
    motor_inferencia_usado: string;
    valores_pdf: any[];
    sistolica_usada: number;
    diastolica_usada: number;
    valores_usados: string;
    ruta_pdf_cedula?: string;
    ruta_pdf_diagnostico?: string;
    doctorId?: number;
    doctorNombre?: string;
  };
  mensaje: string;
}

export interface EstadoResponse {
  success: boolean;
  data: {
    scriptExist: boolean;
    scriptPath: string;
    pythonPath: string;
  };
  servidor: string;
}

export interface UltimoExpedienteResponse {
  success: boolean;
  data: {
    folio: number;
    fecha_consulta: string;
    id_paciente: number;
    nombre_paciente: string;
    ap_paterno_paciente: string;
    ap_materno_paciente: string;
    edad: number;
    sistolica: number;
    diastolica: number;
    presion_pdf_sistolica: number;
    presion_pdf_diastolica: number;
    prediccion_crisis: number;
    probabilidad_porcentual: number;
    nivel_riesgo: string;
    motor_utilizado: string;
    tiene_pdf_cedula: boolean;
    tiene_pdf_diagnostico: boolean;
    pdf_cedula_base64: string | null;
    pdf_diagnostico_base64: string | null;
  };
}

export interface PdfResponse {
  folio: number;
  fecha_consulta: string;
  cedula_medico: string;
  edad: number;
  sistolica: number;
  diastolica: number;
  nivel_riesgo: string;
  tiene_pdf_cedula: boolean;
  tiene_pdf_diagnostico: boolean;
  pdf_cedula_base64: string | null;
  pdf_diagnostico_base64: string | null;
}

// ==========================================================================
// INTERFACES PARA ADMINISTRACION (ACTUALIZADAS)
// ==========================================================================
export interface ResumenAdminResponse {
  total: number;
  programadas: number;
  confirmadas: number;
  completadas: number;
  canceladas: number;
  no_asistio: number;
  proximas: number;
  vencidas: number;
  presenciales: number;
  virtuales: number;
}

export interface CuposPorHoraResponse {
  fecha: string;
  horarios: Array<{
    horacita: string;
    total: number;
    cupos_disponibles: number;
    estados: string[];
    correos: string[];
  }>;
  total_horarios: number;
  horarios_disponibles: number;
}

// ==========================================================================
// INTERFACES PARA HISTORIAL Y PROXIMAS CITAS
// ==========================================================================
export interface ProximasCitasResponse {
  success: boolean;
  citas: any[];
  total: number;
}

export interface HistorialCitasResponse {
  success: boolean;
  citas: any[];
  total: number;
  limite: number;
  offset: number;
  totalPaginas: number;
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
  // --- AUTENTICACION ---
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
    console.log('ESTABLECIENDO SESION - Datos recibidos:', res);

    const nombre = res.nombre || '';
    const apPaterno = res.apPaterno || '';
    const apMaterno = res.apMaterno || '';
    const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim() || nombre;

    const userId = res.uid || res.idusuario || res.id || res.idUsuario || res.userId || null;

    const usuarioProcesado = {
      ...res,
      uid: res.uid || '',
      idusuario: userId,
      nombre: res.nombre || 'Usuario',
      nombreCompleto: nombreCompleto,
      rol: res.rol || 'Paciente',
      correo: res.correo || res.Email || res.email || '',
      apPaterno: apPaterno,
      apMaterno: apMaterno,
      telefono: res.telefono || '',
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(res.nombre || 'Usuario')}&background=b0001e&color=fff&bold=true`
    };

    console.log('USUARIO PROCESADO (guardado en localStorage):', usuarioProcesado);
    console.log('ID de usuario guardado:', usuarioProcesado.idusuario);
    console.log('Nombre completo guardado:', usuarioProcesado.nombreCompleto);

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
  // --- PERFIL DE USUARIO ---
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
  // --- GESTION DE CITAS ---
  // ==========================================================================
  crearCita(datosCita: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/citas/agendar-cita`, datosCita);
  }

  getAllCitas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/todas-las-citas`);
  }

  getMisCitas(email: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/mis-citas/${email}`);
  }

  actualizarEstadoCita(idCita: number | string, datos: { estado: string, notasDoctor?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/citas/actualizar-cita/${idCita}`, datos);
  }

  getCitaById(idCita: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/cita/${idCita}`);
  }

  getCitasByFecha(fecha: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/citas/fecha/${fecha}`);
  }

  getCitasHoy(): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/citas/hoy`);
  }

  actualizarCita(idCita: number | string, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/citas/cita/${idCita}`, datos);
  }

  cancelarCita(idCita: number | string, motivoCancelacion?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/citas/cita/${idCita}/cancelar`, { motivoCancelacion });
  }

  getEstadisticasCitas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/citas/estadisticas`);
  }

  eliminarCita(idCita: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/citas/cita/${idCita}`);
  }

  getHistorialCita(idCita: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/citas/cita/${idCita}/historial`);
  }

  guardarHistorialCita(data: {
    idCita: number | string;
    accion: string;
    detalle: string;
    usuario?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/citas/cita/historial`, data);
  }

  // ==========================================================================
  // --- NUEVAS RUTAS PARA DISPONIBILIDAD DE CITAS ---
  // ==========================================================================

  /**
   * Verifica si una fecha y hora específicas están disponibles
   * @param fecha - Fecha en formato YYYY-MM-DD
   * @param hora - Hora en formato HH:MM
   * @param email - Email del usuario (opcional)
   * @returns Observable con la respuesta de disponibilidad
   */
  verificarDisponibilidad(fecha: string, hora: string, email?: string): Observable<DisponibilidadResponse> {
    const params: any = { fecha, hora };
    if (email) {
      params.email = email;
    }
    return this.http.get<DisponibilidadResponse>(
      `${this.apiUrl}/citas/verificar-disponibilidad`,
      { params }
    );
  }

  /**
   * Obtiene todos los horarios disponibles para una fecha específica
   * @param fecha - Fecha en formato YYYY-MM-DD
   * @param email - Email del usuario (opcional)
   * @returns Observable con la lista de horarios disponibles
   */
  getHorariosDisponibles(fecha: string, email?: string): Observable<HorariosDisponiblesResponse> {
    const params: any = { fecha };
    if (email) {
      params.email = email;
    }
    return this.http.get<HorariosDisponiblesResponse>(
      `${this.apiUrl}/citas/horarios-disponibles`,
      { params }
    );
  }

  /**
   * Obtiene los horarios con cupos disponibles para hoy
   * @returns Observable con los horarios disponibles de hoy
   */
  getCitasDisponiblesHoy(): Observable<CitasDisponiblesHoyResponse> {
    return this.http.get<CitasDisponiblesHoyResponse>(
      `${this.apiUrl}/citas/disponibles/hoy`
    );
  }

  /**
   * Obtiene las próximas citas de un usuario (no canceladas)
   * @param email - Email del usuario
   * @returns Observable con las próximas citas
   */
  getProximasCitas(email: string): Observable<ProximasCitasResponse> {
    return this.http.get<ProximasCitasResponse>(
      `${this.apiUrl}/citas/consultas/proximas/${email}`
    );
  }

  /**
   * Obtiene el historial completo de citas de un usuario con paginación
   * @param email - Email del usuario
   * @param limite - Número de registros por página (default: 10)
   * @param offset - Desplazamiento para la paginación (default: 0)
   * @returns Observable con el historial de citas
   */
  getHistorialCompletoCitas(email: string, limite: number = 10, offset: number = 0): Observable<HistorialCitasResponse> {
    return this.http.get<HistorialCitasResponse>(
      `${this.apiUrl}/citas/consultas/historial/${email}?limite=${limite}&offset=${offset}`
    );
  }

  /**
   * Verifica disponibilidad para múltiples fechas y horarios a la vez
   * @param citas - Array de objetos con fecha, hora y email
   * @returns Observable con los resultados de disponibilidad
   */
  verificarDisponibilidadMasiva(citas: DisponibilidadMasivaItem[]): Observable<DisponibilidadMasivaResponse> {
    return this.http.post<DisponibilidadMasivaResponse>(
      `${this.apiUrl}/citas/consultas/disponibilidad-masiva`,
      { citas }
    );
  }

  // ==========================================================================
  // --- RUTAS PARA ADMINISTRACION DE CITAS ---
  // ==========================================================================

  /**
   * Obtiene un resumen general de todas las citas (solo administradores)
   * @returns Observable con el resumen de citas
   */
  getResumenCitasAdmin(): Observable<ResumenAdminResponse> {
    return this.http.get<ResumenAdminResponse>(
      `${this.apiUrl}/citas/admin/resumen`
    );
  }

  /**
   * Obtiene la ocupación de citas por hora para una fecha específica (solo administradores)
   * @param fecha - Fecha en formato YYYY-MM-DD
   * @returns Observable con los cupos por hora
   */
  getCuposPorHora(fecha: string): Observable<CuposPorHoraResponse> {
    return this.http.get<CuposPorHoraResponse>(
      `${this.apiUrl}/citas/admin/cupos-por-hora/${fecha}`
    );
  }

  // ==========================================================================
  // --- GESTION DE USUARIOS ---
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
  // --- GESTION DE MEDICAMENTOS ---
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

  getEstadisticasMedicamento(idMedicamento: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/medicamentos/medicamento/${idMedicamento}/estadisticas`);
  }

  // ==========================================================================
  // --- GESTION DE TRATAMIENTOS ---
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
  // --- GESTION DE TOMAS ---
  // ==========================================================================

  getTomasByTratamiento(idTratamiento: number | string): Observable<RegistroToma[]> {
    return this.http.get<RegistroToma[]>(`${this.apiUrl}/tomas/tratamiento/${idTratamiento}`);
  }

  getEstadisticasTomas(idTratamiento: number | string): Observable<{
    totalTomas: number;
    tomasCompletadas: number;
    tomasPendientes: number;
    tomasOmitidas: number;
    tomasRetrasadas: number;
    porcentajeCumplimiento: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/tomas/tratamiento/${idTratamiento}/estadisticas`);
  }

  registrarToma(data: {
    idTratamiento: number;
    fechaHoraProgramada: string;
    idAcompananteQueRegistro?: number;
    notasTomas?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tomas`, data);
  }

  generarTomasProgramadas(data: {
    idTratamiento: number;
    fechaInicio: string;
    fechaFin: string;
    frecuenciaHoras: number;
  }): Observable<{
    message: string;
    totalGeneradas: number;
    tomas: RegistroToma[];
  }> {
    return this.http.post<any>(`${this.apiUrl}/tomas/generar`, data);
  }

  actualizarEstadoToma(
    id: number,
    estado: string,
    fechaHoraRealizada?: string,
    notasTomas?: string
  ): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/tomas/${id}`, {
      estado,
      fechaHoraRealizada,
      notasTomas
    });
  }

  marcarTomaComoTomada(id: number, notas?: string): Observable<any> {
    const fechaRealizada = new Date().toISOString();
    return this.actualizarEstadoToma(id, 'Tomada', fechaRealizada, notas);
  }

  marcarTomaComoOmitida(id: number, notas?: string): Observable<any> {
    return this.actualizarEstadoToma(id, 'Omitida', undefined, notas);
  }

  marcarTomaComoRetrasada(id: number, notas?: string): Observable<any> {
    return this.actualizarEstadoToma(id, 'Retrasada', undefined, notas);
  }

  eliminarToma(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/tomas/${id}`);
  }

  eliminarTodasTomas(idTratamiento: number): Observable<any> {
    console.log(`[Service] Eliminando todas las tomas del tratamiento ID: ${idTratamiento}`);
    return this.http.delete<any>(`${this.apiUrl}/tomas/tratamiento/${idTratamiento}/todas`);
  }

  // ==========================================================================
  // --- GESTION DE DISPOSITIVOS ---
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
    return this.http.get<any[]>(`${this.apiUrl}/dispositivos/dispositivos`).pipe(
      map((dispositivos: any[]) => {
        return dispositivos.filter((d: any) => {
          const pacienteId = d.idpacienteasociado || d.idPacienteAsociado || d.pacienteId || d.idusuario;
          return pacienteId === idPaciente;
        });
      })
    );
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
  // --- GESTION DE MEDICIONES ---
  // ==========================================================================

  registrarMedicion(datos: MedicionData): Observable<any> {
    const payload = {
      idPaciente: datos.idPaciente,
      sistolica: datos.sistolica,
      diastolica: datos.diastolica,
      pulso: datos.pulso,
      metodoSincronizacion: datos.metodoSincronizacion || 'Manual'
    };
    return this.http.post(`${this.apiUrl}/mediciones`, payload);
  }

  getMedicionesPaciente(
    idPaciente: number | string,
    limite?: number
  ): Observable<any> {
    let url = `${this.apiUrl}/mediciones/paciente/${idPaciente}`;
    if (limite) {
      url += `?limite=${limite}`;
    }
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
      `${this.apiUrl}/mediciones/paciente/${idPaciente}/rango?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
    );
  }

  getEstadisticasMediciones(
    idPaciente: number | string,
    periodo?: 'dia' | 'semana' | 'mes' | 'trimestre'
  ): Observable<any> {
    let url = `${this.apiUrl}/mediciones/paciente/${idPaciente}/estadisticas`;
    if (periodo) {
      url += `?periodo=${periodo}`;
    }
    return this.http.get(url);
  }

  eliminarMedicion(idMedicion: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mediciones/medicion/${idMedicion}`);
  }

  registrarMultiplesMediciones(mediciones: any[]): Observable<any> {
    const medicionesFormateadas = mediciones.map(m => ({
      idPaciente: m.idPaciente,
      sistolica: m.sistolica,
      diastolica: m.diastolica,
      pulso: m.pulso,
      metodoSincronizacion: m.metodoSincronizacion || 'Manual'
    }));
    return this.http.post(`${this.apiUrl}/mediciones/registrar-multiples`, { mediciones: medicionesFormateadas });
  }

  obtenerMedicionTensiometro(idPaciente: number | string): Observable<any> {
    console.log(`[Service] Solicitando medicion para paciente ID: ${idPaciente}`);
    return this.http.get(`${this.apiUrl}/mediciones/tensiometro/${idPaciente}`);
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

  // ==========================================================================
  // --- GESTION DE SOLICITUDES DE ASIGNACION ---
  // ==========================================================================

  solicitarAsignacionPaciente(idAcompanante: number, data: {
    correoPaciente: string;
    parentesco: string;
    notas: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/solicitudes/solicitar/${idAcompanante}`, data);
  }

  getMisSolicitudes(idAcompanante: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/solicitudes/mis-solicitudes/${idAcompanante}`);
  }

  getPacientesAsignados(idAcompanante: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/solicitudes/mis-pacientes/${idAcompanante}`);
  }

  getTodasLasSolicitudes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/solicitudes/todas`);
  }

  getSolicitudesPendientes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/solicitudes/pendientes`);
  }

  aprobarSolicitud(idSolicitud: number, idAdmin: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/solicitudes/aprobar/${idSolicitud}`, { idAdmin });
  }

  rechazarSolicitud(idSolicitud: number, idAdmin: number, motivo?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/solicitudes/rechazar/${idSolicitud}`, { idAdmin, motivo });
  }

  eliminarAsignacion(idAsignacion: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/solicitudes/asignacion/${idAsignacion}`);
  }

  // ==========================================================================
  // --- ALGORITMO - ANALISIS DE HIPERTENSION ---
  // ==========================================================================

  verificarEstadoAlgoritmo(): Observable<EstadoResponse> {
    return this.http.get<EstadoResponse>(`${this.apiUrl}/algorithm/estado`);
  }

  analizarConPDF(request: AnalisisRequest): Observable<AnalisisResponse> {
    const formData = new FormData();

    formData.append('edad', request.edad.toString());
    formData.append('sistolica', request.sistolica.toString());
    formData.append('diastolica', request.diastolica.toString());
    formData.append('tomaMedicamento', request.tomaMedicamento.toString());
    formData.append('idPaciente', request.idPaciente.toString());

    if (request.idDoctor) {
      formData.append('idDoctor', request.idDoctor.toString());
    }

    if (request.cedulaMedico) {
      formData.append('cedulaMedico', request.cedulaMedico);
    }

    formData.append('pdf', request.pdf, request.pdf.name);

    return this.http.post<AnalisisResponse>(
      `${this.apiUrl}/algorithm/analizar`,
      formData
    );
  }

  analizarConMultiplesPDFs(request: AnalisisCompletoRequest): Observable<AnalisisResponse> {
    const formData = new FormData();

    formData.append('edad', request.edad.toString());
    formData.append('sistolica', request.sistolica.toString());
    formData.append('diastolica', request.diastolica.toString());
    formData.append('tomaMedicamento', request.tomaMedicamento.toString());
    formData.append('idPaciente', request.idPaciente.toString());

    if (request.idDoctor) {
      formData.append('idDoctor', request.idDoctor.toString());
    }

    if (request.cedulaMedico) {
      formData.append('cedulaMedico', request.cedulaMedico);
    }

    formData.append('cedula', request.cedula, request.cedula.name);
    formData.append('diagnostico', request.diagnostico, request.diagnostico.name);

    return this.http.post<AnalisisResponse>(
      `${this.apiUrl}/algorithm/analizar-completo`,
      formData
    );
  }

  obtenerUltimoExpediente(idPaciente: number): Observable<UltimoExpedienteResponse> {
    return this.http.get<UltimoExpedienteResponse>(
      `${this.apiUrl}/algorithm/ultimo-expediente/${idPaciente}`
    );
  }

  obtenerPDFExpediente(folio: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/algorithm/pdf/${folio}`,
      { responseType: 'blob' }
    );
  }

  // ============================================ 
  // MÉTODOS PARA ASIGNACIONES
  // ============================================ 

  // Obtener todas las asignaciones 
  getAllAsignaciones(): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/asignaciones`);
  }

  // Obtener asignación por ID 
  getAsignacionById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/asignacion/${id}`);
  }

  // Obtener estadísticas de asignaciones 
  getEstadisticasAsignaciones(): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/estadisticas`);
  }

  // Obtener todos los doctores (con conteo de pacientes) 
  getDoctoresCompletos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/doctores`);
  }

  // Obtener doctor por ID 
  getDoctorCompleto(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/doctor/${id}`);
  }

  // Obtener pacientes de un doctor específico 
  getPacientesDeDoctor(idDoctor: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/doctor/${idDoctor}/pacientes`);
  }

  // Obtener pacientes asignados a un doctor con detalles 
  getPacientesAsignadosDetalle(idDoctor: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/doctor/${idDoctor}/pacientes-detalle`);
  }

  // Obtener todos los pacientes 
  getTodosLosPacientes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/pacientes`);
  }

  // Obtener pacientes sin asignar 
  getPacientesSinAsignarCompleto(): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/pacientes/sin-asignar`);
  }

  // Obtener doctor de un paciente específico 
  getDoctorDePaciente(idPaciente: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/paciente/${idPaciente}/doctor`);
  }

  // Verificar si paciente tiene doctor asignado 
  verificarPacienteAsignadoCompleto(idPaciente: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/asignaciones/paciente/${idPaciente}/verificar`);
  }

  // Asignar paciente a doctor 
  asignarPacienteADoctor(data: {
    idPaciente: number;
    idDoctor: number;
    asignadoPor?: number;
    notas?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/asignaciones/asignar`, data);
  }

  // Asignar múltiples pacientes a un doctor 
  asignarMultiplesPacientesADoctor(data: {
    idDoctor: number;
    pacientesIds: number[];
    asignadoPor?: number;
    notas?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/asignaciones/asignar-multiples`, data);
  }

  // Desasignar paciente de doctor 
  desasignarPacienteDeDoctor(idPaciente: number, idDoctor: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/asignaciones/desasignar`, { idPaciente, idDoctor });
  }

  // Desasignar todos los pacientes de un doctor 
  desasignarTodosPacientesDeDoctor(idDoctor: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/asignaciones/doctor/${idDoctor}/desasignar-todos`);
  }
}