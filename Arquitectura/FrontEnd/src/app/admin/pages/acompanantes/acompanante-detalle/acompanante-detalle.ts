import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GoogleService } from '../../../../auth/services/google';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

interface HistorialAcompanante {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

type TabAcompanante = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-acompanante-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './acompanante-detalle.html',
  styleUrls: ['./acompanante-detalle.css']
})
export class AcompananteDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private titleService = inject(Title);

  usuarioSeleccionado: any = null;
  isSaving = false;

  // Pestaña activa
  activeTab: TabAcompanante = 'info';

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // Referencias Flatpickr
  private fpNacimientoInstance: any = null;
  private fpAsignacionInstance: any = null;

  // Historial de cambios
  historialCambios: HistorialAcompanante[] = [];

  // Lista de visitas del acompañante
  visitasAcompanante: any[] = [];

  // Estadísticas
  estadisticas: {
    totalVisitas: number;
    visitasCompletadas: number;
    visitasPendientes: number;
    visitasCanceladas: number;
    ultimaVisita: string | null;
    proximaVisita: string | null;
  } | null = null;

  // ID del acompañante
  acompananteId: number | null = null;

  // Fecha de generación del expediente
  fechaGeneracion = '';

  ngOnInit() {
    let state: any = null;

    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    this.fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    if (state && state.usuario) {
      this.acompananteId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();

      this.cargarDatosCompletosAcompanante();
      this.cargarDatosReales();

      setTimeout(() => {
        this.inicializarCalendarios();
      }, 500);

    } else {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/acompanantes']);
      }
    }
  }

  // --- CONTROL DE PESTAÑAS ---
  cambiarTab(tab: TabAcompanante) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();

    if (tab === 'info') {
      setTimeout(() => this.inicializarCalendarios(), 100);
    }
  }

  // --- INICIALIZAR CALENDARIOS ---
  inicializarCalendarios() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Destruir instancias previas
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.fpAsignacionInstance) {
      try { this.fpAsignacionInstance.destroy(); } catch (e) { }
      this.fpAsignacionInstance = null;
    }

    // --- Fecha de Nacimiento ---
    const nacimientoEl = document.querySelector('#fechaNacimientoInput') as HTMLInputElement;
    if (nacimientoEl) {
      const configNacimiento: any = {
        locale: Spanish,
        dateFormat: "Y-m-d",
        defaultDate: this.usuarioSeleccionado?.fechaNacimiento || null,
        maxDate: "today",
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.usuarioSeleccionado) {
            this.usuarioSeleccionado.fechaNacimiento = dateStr;
            this.cdr.detectChanges();
          }
        }
      };
      this.fpNacimientoInstance = flatpickr('#fechaNacimientoInput', configNacimiento);
    }

    // --- Fecha de Asignación ---
    const asignacionEl = document.querySelector('#fechaInput') as HTMLInputElement;
    if (asignacionEl) {
      const hoy = new Date();
      const fechaMaximaAsignacion = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

      const configAsignacion: any = {
        locale: Spanish,
        dateFormat: "Y-m-d",
        defaultDate: this.usuarioSeleccionado?.fechaAsignacion || "today",
        minDate: "today",
        maxDate: fechaMaximaAsignacion,
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.usuarioSeleccionado) {
            this.usuarioSeleccionado.fechaAsignacion = dateStr;
            this.cdr.detectChanges();
          }
        }
      };
      this.fpAsignacionInstance = flatpickr('#fechaInput', configAsignacion);
    }
  }

  // --- CARGAR DATOS ---
  async cargarDatosCompletosAcompanante() {
    if (!this.acompananteId) return;

    try {
      const usuarioActualizado = await firstValueFrom(
        this.usersService.getUsuarioById(this.acompananteId)
      );

      if (usuarioActualizado) {
        this.usuarioSeleccionado = {
          ...this.usuarioSeleccionado,
          ...usuarioActualizado
        };
        this.inicializarCampos();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.warn('Usando datos del state para el acompañante');
    }
  }

  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    const u = this.usuarioSeleccionado;
    u.nombre = u.nombre || '';
    u.apPaterno = u.apPaterno || '';
    u.apMaterno = u.apMaterno || '';
    u.correo = u.correo || '';
    u.telefono = u.telefono || '';
    u.genero = u.genero || 'No especificado';
    u.fechaNacimiento = u.fechaNacimiento || '';
    u.fechaAsignacion = u.fechaAsignacion || '';
    u.curp = u.curp || '';
    u.domicilio = u.domicilio || '';
    u.codigoPostal = u.codigoPostal || '';
    u.localidad = u.localidad || '';
    u.municipio = u.municipio || '';
    u.estado = u.estado || '';
    u.activo = u.activo !== undefined ? u.activo : true;

    this.cdr.detectChanges();
  }

  async cargarDatosReales() {
    if (!this.usuarioSeleccionado?.correo) return;

    try {
      // Aquí cargarías las visitas del acompañante desde la API
      // Por ahora usamos datos de ejemplo
      this.visitasAcompanante = [
        {
          id: 1,
          fechavisita: '2026-07-10',
          horavisita: '10:30',
          motivo: 'Visita de seguimiento',
          estado: 'Completada'
        },
        {
          id: 2,
          fechavisita: '2026-07-20',
          horavisita: '15:00',
          motivo: 'Revisión de documentación',
          estado: 'Programada'
        }
      ];

      this.calcularEstadisticas(this.visitasAcompanante);
      this.generarHistorialDesdeVisitas(this.visitasAcompanante);

    } catch (error) {
      console.error('Error al cargar visitas del acompañante:', error);
      this.visitasAcompanante = [];
      this.estadisticas = {
        totalVisitas: 0,
        visitasCompletadas: 0,
        visitasPendientes: 0,
        visitasCanceladas: 0,
        ultimaVisita: null,
        proximaVisita: null
      };
    } finally {
      this.cdr.detectChanges();
    }
  }

  calcularEstadisticas(visitas: any[]) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const completadas = visitas.filter(v => v.estado === 'Completada');
    const pendientes = visitas.filter(v => v.estado === 'Programada' || v.estado === 'Confirmada');
    const canceladas = visitas.filter(v => v.estado === 'Cancelada' || v.estado === 'No Asistió');

    const visitasOrdenadas = [...visitas].sort((a, b) => {
      const fechaA = new Date(`${a.fechavisita}T${a.horavisita || '00:00'}`);
      const fechaB = new Date(`${b.fechavisita}T${b.horavisita || '00:00'}`);
      return fechaB.getTime() - fechaA.getTime();
    });

    const ultimaVisita = visitasOrdenadas.length > 0 ? visitasOrdenadas[0] : null;

    const visitasFuturas = visitas.filter(v => {
      const fechaVisita = new Date(v.fechavisita);
      return fechaVisita >= hoy && (v.estado === 'Programada' || v.estado === 'Confirmada');
    }).sort((a, b) => {
      return new Date(a.fechavisita).getTime() - new Date(b.fechavisita).getTime();
    });

    const proximaVisita = visitasFuturas.length > 0 ? visitasFuturas[0] : null;

    this.estadisticas = {
      totalVisitas: visitas.length,
      visitasCompletadas: completadas.length,
      visitasPendientes: pendientes.length,
      visitasCanceladas: canceladas.length,
      ultimaVisita: ultimaVisita ? ultimaVisita.fechavisita : null,
      proximaVisita: proximaVisita ? proximaVisita.fechavisita : null
    };
  }

  generarHistorialDesdeVisitas(visitas: any[]) {
    const historial: HistorialAcompanante[] = [];

    const visitasOrdenadas = [...visitas].sort((a, b) => {
      return new Date(b.fechavisita).getTime() - new Date(a.fechavisita).getTime();
    });

    visitasOrdenadas.forEach(visita => {
      const fechaFormateada = this.formatearFechaYHora(visita.fechavisita, visita.horavisita);
      let accion = '';
      let detalle = '';

      switch (visita.estado) {
        case 'Completada':
          accion = 'Visita completada';
          detalle = `Visita del ${fechaFormateada} - ${visita.motivo || 'Sin motivo'}`;
          break;
        case 'Programada':
          accion = 'Visita programada';
          detalle = `Visita para ${fechaFormateada} - ${visita.motivo || 'Sin motivo'}`;
          break;
        case 'Confirmada':
          accion = 'Visita confirmada';
          detalle = `Visita confirmada para ${fechaFormateada}`;
          break;
        case 'Cancelada':
          accion = 'Visita cancelada';
          detalle = `Visita del ${fechaFormateada} - Cancelada`;
          break;
        case 'No Asistió':
          accion = 'No asistió';
          detalle = `No asistió a visita del ${fechaFormateada}`;
          break;
        default:
          accion = 'Visita registrada';
          detalle = `Visita del ${fechaFormateada}`;
      }

      historial.push({
        fecha: fechaFormateada,
        accion: accion,
        detalle: detalle,
        usuario: 'Sistema'
      });
    });

    if (historial.length === 0) {
      const fechaActual = new Date();
      const fechaStr = fechaActual.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      historial.push({
        fecha: fechaStr,
        accion: 'Acompañante registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      });
    }

    this.historialCambios = historial;
  }

  // --- MÉTODOS DE UTILIDAD ---
  formatearFechaYHora(fecha: string, hora: string): string {
    if (!fecha) return 'Fecha no disponible';

    try {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) return fecha;

      const dia = String(fechaObj.getDate()).padStart(2, '0');
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const anio = fechaObj.getFullYear();
      const fechaFormateada = `${dia}/${mes}/${anio}`;

      let horaFormateada = '--:--';
      if (hora) {
        let horaLimpia = hora;
        if (horaLimpia.includes('T')) {
          horaLimpia = horaLimpia.split('T')[1] || '00:00';
        }
        if (horaLimpia.length > 5) {
          horaLimpia = horaLimpia.substring(0, 5);
        }
        if (horaLimpia.includes(':')) {
          const partes = horaLimpia.split(':');
          if (partes.length >= 2) {
            horaFormateada = `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
          }
        } else {
          horaFormateada = horaLimpia;
        }
      }

      return `${fechaFormateada} ${horaFormateada}`;
    } catch (error) {
      return fecha;
    }
  }

  limpiarFecha(fecha: any): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') {
      return fecha.includes('T') ? fecha.split('T')[0] : fecha;
    }
    return new Date(fecha).toISOString().split('T')[0];
  }

  // --- ESTADO DEL ACOMPAÑANTE ---
  getEstadoAcompanante(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.visitasPendientes > 0) {
      return { texto: `${this.estadisticas.visitasPendientes} visitas pendientes`, clase: 'estado-pendiente', icono: 'bi-clock-fill' };
    }

    if (this.estadisticas && this.estadisticas.totalVisitas > 0) {
      return { texto: 'Activo con historial', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
    }

    return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  // --- UBICACIÓN ---
  tieneUbicacionCompleta(): boolean {
    const u = this.usuarioSeleccionado;
    if (!u) return false;
    return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
  }

  getUbicacionFormateada(): string {
    const u = this.usuarioSeleccionado;
    if (!u) return '';
    const partes = [
      u.domicilio,
      u.localidad,
      u.municipio,
      u.estado,
      u.codigoPostal ? `CP ${u.codigoPostal}` : ''
    ].filter(Boolean);
    return partes.length ? partes.join(', ') : 'Sin ubicación registrada';
  }

  // --- FORMATEO DE CAMPOS ---
  formatearCURP() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = this.usuarioSeleccionado.curp.toUpperCase().trim();
      this.cdr.detectChanges();
    }
  }

  formatearCodigoPostal() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.codigoPostal) {
      const cp = this.usuarioSeleccionado.codigoPostal.replace(/\D/g, '').slice(0, 5);
      this.usuarioSeleccionado.codigoPostal = cp;
      this.cdr.detectChanges();
    }
  }

  capitalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.split(' ').map(palabra =>
      palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
  }

  formatearCampoTexto(campo: string) {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado[campo]) {
      this.usuarioSeleccionado[campo] = this.capitalizarTexto(this.usuarioSeleccionado[campo]);
      this.cdr.detectChanges();
    }
  }

  // --- EXPEDIENTE ---
  calcularEdad(): number | null {
    const fechaNacimiento = this.usuarioSeleccionado?.fechaNacimiento;
    if (!fechaNacimiento) return null;

    const nacimiento = new Date(fechaNacimiento);
    if (isNaN(nacimiento.getTime())) return null;

    const hoy = new Date();
    let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
    const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
    if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) {
      edad--;
    }
    return edad >= 0 ? edad : null;
  }

  formatearFechaNacimiento(fecha: string): string {
    if (!fecha) return 'No registrada';

    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;

      const dia = String(d.getUTCDate()).padStart(2, '0');
      const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
      const anio = d.getUTCFullYear();

      return `${dia}/${mes}/${anio}`;
    } catch (error) {
      return fecha;
    }
  }

  imprimirExpediente() {
    if (!isPlatformBrowser(this.platformId)) return;

    const nombreCompleto = [
      this.usuarioSeleccionado?.nombre,
      this.usuarioSeleccionado?.apPaterno,
      this.usuarioSeleccionado?.apMaterno
    ].filter(Boolean).join(' ').trim();

    const tituloOriginal = this.titleService.getTitle();
    this.titleService.setTitle(`Expediente Acompanante - ${nombreCompleto || 'Acompañante'}`);

    const restaurarTitulo = () => {
      this.titleService.setTitle(tituloOriginal);
      window.removeEventListener('afterprint', restaurarTitulo);
    };
    window.addEventListener('afterprint', restaurarTitulo);

    setTimeout(() => window.print(), 50);
  }

  // --- GUARDAR CAMBIOS ---
  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.apPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.apMaterno || '').trim();
    const correo = (this.usuarioSeleccionado.correo || '').trim();
    const telefono = (this.usuarioSeleccionado.telefono || '').trim();

    if (!nombre || !apPaterno || !apMaterno || !correo || !telefono) {
      this.lanzarNotificacion("Todos los campos personales básicos son obligatorios.", "warning");
      return;
    }

    if (!this.usuarioSeleccionado.fechaNacimiento || !this.usuarioSeleccionado.fechaAsignacion) {
      this.lanzarNotificacion("La fecha de nacimiento y asignación son obligatorias.", "warning");
      return;
    }

    this.isSaving = true;
    const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

    try {
      const payload = {
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        correo: correo,
        telefono: telefono,
        genero: this.usuarioSeleccionado.genero,
        activo: this.usuarioSeleccionado.activo ?? true,
        rol: 'Acompañante',
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento,
        fechaAsignacion: this.usuarioSeleccionado.fechaAsignacion,
        curp: (this.usuarioSeleccionado.curp || '').trim().toUpperCase(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      // Validación CURP
      if (payload.curp && payload.curp.length > 0) {
        const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
        if (!curpRegex.test(payload.curp)) {
          this.lanzarNotificacion("El formato de CURP no es válido. Debe tener 18 caracteres alfanuméricos.", "warning");
          this.isSaving = false;
          return;
        }
      }

      // Validación Código Postal
      if (payload.codigoPostal && payload.codigoPostal.length > 0) {
        const cpRegex = /^[0-9]{5}$/;
        if (!cpRegex.test(payload.codigoPostal)) {
          this.lanzarNotificacion("El código postal debe tener 5 dígitos numéricos.", "warning");
          this.isSaving = false;
          return;
        }
      }

      await firstValueFrom(this.usersService.updateUsuario(id, payload));

      this.lanzarNotificacion("¡Éxito! La información del acompañante ha sido actualizada.", "success");

      this.agregarHistorial('Datos actualizados', 'Información del acompañante actualizada');

      setTimeout(() => {
        this.router.navigate(['/acompanantes']);
      }, 2000);

    } catch (error: any) {
      console.error("Error al guardar cambios:", error);
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo guardar: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  agregarHistorial(accion: string, detalle: string) {
    const ahora = new Date();
    const fechaStr = ahora.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.historialCambios.unshift({
      fecha: fechaStr,
      accion: accion,
      detalle: detalle,
      usuario: 'Usuario actual'
    });
  }

  // --- TOAST ---
  lanzarNotificacion(mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    this.cdr.detectChanges();

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      this.mostrarToast = false;
      this.cdr.detectChanges();
    }, 4000);
  }

  volver() {
    this.location.back();
  }

  ngOnDestroy() {
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.fpAsignacionInstance) {
      try { this.fpAsignacionInstance.destroy(); } catch (e) { }
      this.fpAsignacionInstance = null;
    }
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }
}