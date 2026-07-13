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
  sistolica: number;  // CORREGIDO: antes era "sistólica" con acento
  diastolica: number; // CORREGIDO: antes era "diastólica" con acento
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

// NUEVA INTERFAZ PARA TOMAS
export interface RegistroToma {
  id?: number;
  idTratamiento: number;
  fechaProgramada: string;
  fechaRealizada?: string;
  estado: 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada';
  notas?: string;
  idAcompanante?: number;
  nombreAcompanante?: string;
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
  // --- GESTIÓN DE CITAS ---
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

  getEstadisticasMedicamento(idMedicamento: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/medicamentos/medicamento/${idMedicamento}/estadisticas`);
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
  // --- ✅ NUEVO: GESTIÓN DE TOMAS ---
  // ==========================================================================

  /**
   * Obtiene todas las tomas de un tratamiento específico
   * @param idTratamiento ID del tratamiento
   * @returns Observable con el listado de tomas
   */
  getTomasByTratamiento(idTratamiento: number | string): Observable<RegistroToma[]> {
    return this.http.get<RegistroToma[]>(`${this.apiUrl}/tomas/tratamiento/${idTratamiento}`);
  }

  /**
   * Obtiene estadísticas de tomas de un tratamiento
   * @param idTratamiento ID del tratamiento
   * @returns Observable con las estadísticas
   */
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

  /**
   * Registra una nueva toma para un tratamiento
   * @param data Datos de la toma
   * @returns Observable con la toma registrada
   */
  registrarToma(data: {
    idTratamiento: number;
    fechaHoraProgramada: string;
    idAcompananteQueRegistro?: number;
    notasTomas?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tomas`, data);
  }

  /**
   * Genera tomas programadas automáticamente para un tratamiento
   * @param data Datos para generar las tomas
   * @returns Observable con las tomas generadas
   */
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

  /**
   * Actualiza el estado de una toma específica
   * @param id ID de la toma
   * @param estado Nuevo estado ('Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada')
   * @param fechaHoraRealizada Fecha y hora en que se realizó la toma (opcional)
   * @param notasTomas Notas adicionales (opcional)
   * @returns Observable con la toma actualizada
   */
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

  /**
   * Marca una toma como completada (Tomada)
   * @param id ID de la toma
   * @param notas Notas opcionales
   * @returns Observable con la toma actualizada
   */
  marcarTomaComoTomada(id: number, notas?: string): Observable<any> {
    const fechaRealizada = new Date().toISOString();
    return this.actualizarEstadoToma(id, 'Tomada', fechaRealizada, notas);
  }

  /**
   * Marca una toma como omitida
   * @param id ID de la toma
   * @param notas Notas opcionales
   * @returns Observable con la toma actualizada
   */
  marcarTomaComoOmitida(id: number, notas?: string): Observable<any> {
    return this.actualizarEstadoToma(id, 'Omitida', undefined, notas);
  }

  /**
   * Marca una toma como retrasada
   * @param id ID de la toma
   * @param notas Notas opcionales
   * @returns Observable con la toma actualizada
   */
  marcarTomaComoRetrasada(id: number, notas?: string): Observable<any> {
    return this.actualizarEstadoToma(id, 'Retrasada', undefined, notas);
  }

  /**
   * Elimina una toma específica
   * @param id ID de la toma
   * @returns Observable con la toma eliminada
   */
  eliminarToma(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/tomas/${id}`);
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
  // --- GESTIÓN DE MEDICIONES (CORREGIDO) ---
  // ==========================================================================

  /**
   * Registrar una nueva medición manualmente
   */
  registrarMedicion(datos: MedicionData): Observable<any> {
    // Asegurar que los nombres de los campos coincidan con el backend
    const payload = {
      idPaciente: datos.idPaciente,
      sistolica: datos.sistolica,
      diastolica: datos.diastolica,
      pulso: datos.pulso,
      metodoSincronizacion: datos.metodoSincronizacion || 'Manual'
    };
    return this.http.post(`${this.apiUrl}/mediciones`, payload);
  }

  /**
   * Obtener todas las mediciones de un paciente
   */
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

  /**
   * Obtener la última medición de un paciente
   */
  getUltimaMedicionPaciente(idPaciente: number | string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mediciones/paciente/${idPaciente}/ultima`);
  }

  /**
   * Obtener mediciones por rango de fechas
   */
  getMedicionesPorRango(
    idPaciente: number | string,
    fechaInicio: string,
    fechaFin: string
  ): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/mediciones/paciente/${idPaciente}/rango?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
    );
  }

  /**
   * Obtener estadísticas de mediciones por período
   */
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

  /**
   * Eliminar una medición específica
   */
  eliminarMedicion(idMedicion: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mediciones/medicion/${idMedicion}`);
  }

  /**
   * Registrar múltiples mediciones en lote
   */
  registrarMultiplesMediciones(mediciones: any[]): Observable<any> {
    // Asegurar que los campos tengan los nombres correctos
    const medicionesFormateadas = mediciones.map(m => ({
      idPaciente: m.idPaciente,
      sistolica: m.sistolica,
      diastolica: m.diastolica,
      pulso: m.pulso,
      metodoSincronizacion: m.metodoSincronizacion || 'Manual'
    }));
    return this.http.post(`${this.apiUrl}/mediciones/registrar-multiples`, { mediciones: medicionesFormateadas });
  }

  /**
   * OBTENER MEDICIÓN DESDE TENSIÓMETRO VÍA BLUETOOTH
   * Este método ejecuta el script Python que se conecta al dispositivo
   */
  obtenerMedicionTensiometro(idPaciente: number | string): Observable<any> {
    console.log(`[Service] Solicitando medición para paciente ID: ${idPaciente}`);
    // Cambiado a GET porque el controller usa req.params, no req.body
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
}