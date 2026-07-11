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

interface HistorialPaciente {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

type TabPaciente = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-paciente-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './paciente-detalle.html',
  styleUrls: ['./paciente-detalle.css']
})
export class PacienteDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private titleService = inject(Title);

  usuarioSeleccionado: any = null;
  isSaving = false;

  // Pestaña activa del panel del paciente
  activeTab: TabPaciente = 'info';

  // Control de estado para el modal de citas
  mostrarModalCita = false;
  isSavingCita = false;

  nuevaCita = {
    fechaCita: '',
    horaCita: '',
    motivo: '',
    sintomas: '',
    modalidad: 'Presencial'
  };

  // Sistema de Notificaciones Premium
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // Referencias para destruir las instancias al cerrar el modal o salir del componente
  private fpFechaInstance: any = null;
  private fpHoraInstance: any = null;
  private fpNacimientoInstance: any = null;

  // Historial de cambios del paciente
  historialCambios: HistorialPaciente[] = [];

  // Lista de citas del paciente
  citasPaciente: any[] = [];

  // Estadísticas del paciente
  estadisticas: {
    totalCitas: number;
    citasCompletadas: number;
    citasPendientes: number;
    citasCanceladas: number;
    ultimaCita: string | null;
    proximaCita: string | null;
  } | null = null;

  citasCargadas = false;
  cargandoCitas = false;

  // ID del paciente para cargar datos desde la API
  pacienteId: number | null = null;

  // Fecha en la que se generó el expediente (para el membrete)
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
      this.pacienteId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();

      // Cargar datos completos del paciente
      this.cargarDatosCompletosPaciente();
      this.cargarDatosReales();

      // Inicializar calendario con Flatpickr (DESPUÉS de que el DOM esté listo)
      setTimeout(() => {
        this.inicializarCalendarioNacimiento();
      }, 500);

    } else {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/pacientes']);
      }
    }
  }

  // --- CONTROL DE PESTAÑAS ---
  cambiarTab(tab: TabPaciente) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();

    // El input de fecha de nacimiento solo existe en el DOM cuando la
    // pestaña "info" está activa, así que hay que reinicializar Flatpickr
    // cada vez que se regresa a esa pestaña.
    if (tab === 'info') {
      setTimeout(() => this.inicializarCalendarioNacimiento(), 100);
    }
  }

  // Inicializar calendario de fecha de nacimiento con Flatpickr
  inicializarCalendarioNacimiento() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Destruir instancia previa si existe
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }

    // Buscar el elemento y asegurarse de que exista
    const elemento = document.querySelector('#fechaNacimientoInput') as HTMLInputElement;

    if (!elemento) {
      return;
    }

    // Configuración de Flatpickr
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

    try {
      this.fpNacimientoInstance = flatpickr('#fechaNacimientoInput', configNacimiento);
    } catch (error) {
      console.error('Error al inicializar Flatpickr:', error);
    }
  }

  // Cargar datos completos del paciente desde la API
  async cargarDatosCompletosPaciente() {
    if (!this.pacienteId) return;

    try {
      const usuarioActualizado = await firstValueFrom(
        this.usersService.getUsuarioById(this.pacienteId)
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
      console.warn('Usando datos del state para el paciente');
    }
  }

  // Inicializar todos los campos correctamente
  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    const usuario = this.usuarioSeleccionado;

    usuario.tempApellidoPaterno = usuario.apPaterno || usuario.appaterno || '';
    usuario.tempApellidoMaterno = usuario.apMaterno || usuario.apmaterno || '';
    usuario.nombre = usuario.nombre || '';
    usuario.correo = usuario.correo || '';
    usuario.telefono = usuario.telefono || '';
    usuario.genero = usuario.genero || 'No especificado';

    usuario.fechaNacimiento = usuario.fechaNacimiento || '';
    usuario.curp = usuario.curp || '';
    usuario.domicilio = usuario.domicilio || '';
    usuario.codigoPostal = usuario.codigoPostal || '';
    usuario.localidad = usuario.localidad || '';
    usuario.municipio = usuario.municipio || '';
    usuario.estado = usuario.estado || '';

    usuario.nss = usuario.nss || null;
    usuario.tipoSangre = usuario.tipoSangre || null;

    usuario.peso = usuario.peso !== undefined && usuario.peso !== null && usuario.peso !== ''
      ? Number(usuario.peso)
      : null;
    usuario.altura = usuario.altura !== undefined && usuario.altura !== null && usuario.altura !== ''
      ? Number(usuario.altura)
      : null;

    usuario.antecedentesFamiliares = usuario.antecedentesFamiliares || '';
    usuario.activo = usuario.activo !== undefined ? usuario.activo : true;

    this.cdr.detectChanges();
  }

  // Cargar datos reales desde la API
  async cargarDatosReales() {
    if (!this.usuarioSeleccionado?.correo) return;

    this.cargandoCitas = true;
    this.citasCargadas = false;

    try {
      const citas = await firstValueFrom(
        this.usersService.getMisCitas(this.usuarioSeleccionado.correo)
      );

      if (citas && citas.length > 0) {
        this.citasPaciente = citas;
        this.calcularEstadisticas(citas);
        this.generarHistorialDesdeCitas(citas);
      } else {
        this.citasPaciente = [];
        this.estadisticas = {
          totalCitas: 0,
          citasCompletadas: 0,
          citasPendientes: 0,
          citasCanceladas: 0,
          ultimaCita: null,
          proximaCita: null
        };
      }

      this.citasCargadas = true;

    } catch (error) {
      console.error('Error al cargar citas del paciente:', error);
      this.citasPaciente = [];
      this.estadisticas = {
        totalCitas: 0,
        citasCompletadas: 0,
        citasPendientes: 0,
        citasCanceladas: 0,
        ultimaCita: null,
        proximaCita: null
      };
    } finally {
      this.cargandoCitas = false;
      this.cdr.detectChanges();
    }
  }

  // Calcular estadísticas reales desde las citas
  calcularEstadisticas(citas: any[]) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const completadas = citas.filter(c => c.estado === 'Completada');
    const pendientes = citas.filter(c =>
      c.estado === 'Programada' || c.estado === 'Confirmada'
    );
    const canceladas = citas.filter(c => c.estado === 'Cancelada' || c.estado === 'No Asistió');

    const citasOrdenadas = [...citas].sort((a, b) => {
      const fechaA = new Date(`${a.fechacita}T${a.horacita || '00:00'}`);
      const fechaB = new Date(`${b.fechacita}T${b.horacita || '00:00'}`);
      return fechaB.getTime() - fechaA.getTime();
    });

    const ultimaCita = citasOrdenadas.length > 0 ? citasOrdenadas[0] : null;

    const citasFuturas = citas.filter(c => {
      const fechaCita = new Date(c.fechacita);
      return fechaCita >= hoy && (c.estado === 'Programada' || c.estado === 'Confirmada');
    }).sort((a, b) => {
      return new Date(a.fechacita).getTime() - new Date(b.fechacita).getTime();
    });

    const proximaCita = citasFuturas.length > 0 ? citasFuturas[0] : null;

    this.estadisticas = {
      totalCitas: citas.length,
      citasCompletadas: completadas.length,
      citasPendientes: pendientes.length,
      citasCanceladas: canceladas.length,
      ultimaCita: ultimaCita ? ultimaCita.fechacita : null,
      proximaCita: proximaCita ? proximaCita.fechacita : null
    };
  }

  // Generar historial desde citas reales con formato de fecha correcto
  generarHistorialDesdeCitas(citas: any[]) {
    const historial: HistorialPaciente[] = [];

    const citasOrdenadas = [...citas].sort((a, b) => {
      return new Date(b.fechacita).getTime() - new Date(a.fechacita).getTime();
    });

    citasOrdenadas.forEach(cita => {
      let accion = '';
      let detalle = '';

      const fechaFormateada = this.formatearFechaYHora(cita.fechacita, cita.horacita);

      switch (cita.estado) {
        case 'Completada':
          accion = 'Cita completada';
          detalle = `Cita del ${fechaFormateada} - ${cita.motivo || 'Sin motivo'}`;
          break;
        case 'Programada':
          accion = 'Cita programada';
          detalle = `Cita para ${fechaFormateada} - ${cita.motivo || 'Sin motivo'}`;
          break;
        case 'Confirmada':
          accion = 'Cita confirmada';
          detalle = `Cita confirmada para ${fechaFormateada}`;
          break;
        case 'Cancelada':
          accion = 'Cita cancelada';
          detalle = `Cita del ${fechaFormateada} - Cancelada`;
          break;
        case 'No Asistió':
          accion = 'No asistió';
          detalle = `No asistió a cita del ${fechaFormateada}`;
          break;
        default:
          accion = 'Cita registrada';
          detalle = `Cita del ${fechaFormateada} - ${cita.motivo || ''}`;
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
        accion: 'Paciente registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      });
    }

    this.historialCambios = historial;
  }

  // Método para formatear fecha y hora correctamente
  formatearFechaYHora(fecha: string, hora: string): string {
    if (!fecha) return 'Fecha no disponible';

    try {
      const fechaObj = new Date(fecha);

      if (isNaN(fechaObj.getTime())) {
        return fecha;
      }

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

  // Agregar entrada al historial
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

  // Obtener estado del paciente
  getEstadoPaciente(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.citasPendientes > 0) {
      return { texto: `${this.estadisticas.citasPendientes} citas pendientes`, clase: 'estado-pendiente', icono: 'bi-clock-fill' };
    }

    if (this.estadisticas && this.estadisticas.totalCitas > 0) {
      return { texto: 'Activo con historial', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
    }

    return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  // Formatear CURP
  formatearCURP() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = this.usuarioSeleccionado.curp.toUpperCase().trim();
      this.cdr.detectChanges();
    }
  }

  // Formatear código postal
  formatearCodigoPostal() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.codigoPostal) {
      const cp = this.usuarioSeleccionado.codigoPostal.replace(/\D/g, '').slice(0, 5);
      this.usuarioSeleccionado.codigoPostal = cp;
      this.cdr.detectChanges();
    }
  }

  // Capitalizar texto
  capitalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.split(' ').map(palabra =>
      palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
  }

  // Formatear campo de texto
  formatearCampoTexto(campo: string) {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado[campo]) {
      this.usuarioSeleccionado[campo] = this.capitalizarTexto(this.usuarioSeleccionado[campo]);
      this.cdr.detectChanges();
    }
  }

  // Obtener ubicación formateada
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

  // Verificar si tiene ubicación completa
  tieneUbicacionCompleta(): boolean {
    const u = this.usuarioSeleccionado;
    if (!u) return false;
    return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
  }

  // --- CÁLCULOS PARA EL EXPEDIENTE ---

  // Calcula la edad del paciente a partir de su fecha de nacimiento
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

  // Formatea la fecha de nacimiento como dd/mm/aaaa para el expediente
  // (usa componentes UTC para no perder/ganar un día por la zona horaria)
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

  // Calcula el Índice de Masa Corporal y su categoría
  calcularIMC(): { valor: number | null; categoria: string } {
    const peso = this.usuarioSeleccionado?.peso;
    const altura = this.usuarioSeleccionado?.altura;

    if (!peso || !altura || altura <= 0) {
      return { valor: null, categoria: '' };
    }

    const imc = peso / (altura * altura);
    const valor = Math.round(imc * 10) / 10;

    let categoria = 'Peso normal';
    if (imc < 18.5) categoria = 'Bajo peso';
    else if (imc >= 25 && imc < 30) categoria = 'Sobrepeso';
    else if (imc >= 30) categoria = 'Obesidad';

    return { valor, categoria };
  }

  // Imprime únicamente la hoja del expediente sin encabezados del navegador
  imprimirExpediente() {
    if (!isPlatformBrowser(this.platformId)) return;

    const nombreCompleto = [
      this.usuarioSeleccionado?.nombre,
      this.usuarioSeleccionado?.tempApellidoPaterno || this.usuarioSeleccionado?.apPaterno,
      this.usuarioSeleccionado?.tempApellidoMaterno || this.usuarioSeleccionado?.apMaterno
    ].filter(Boolean).join(' ').trim();

    const tituloOriginal = this.titleService.getTitle();
    this.titleService.setTitle(`Expediente Clinico - ${nombreCompleto || 'Paciente'}`);

    const restaurarTitulo = () => {
      this.titleService.setTitle(tituloOriginal);
      window.removeEventListener('afterprint', restaurarTitulo);
    };
    window.addEventListener('afterprint', restaurarTitulo);

    // Usamos setTimeout para asegurar que el título se haya actualizado antes de imprimir
    setTimeout(() => {
      window.print();
    }, 50);
  }

  // Validar campos antes de guardar
  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.nombre || u.nombre.trim().length < 2) {
      return { valido: false, mensaje: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (!u.tempApellidoPaterno || u.tempApellidoPaterno.trim().length < 2) {
      return { valido: false, mensaje: 'El apellido paterno debe tener al menos 2 caracteres' };
    }

    if (!u.correo || !u.correo.includes('@')) {
      return { valido: false, mensaje: 'El correo electrónico no es válido' };
    }

    if (u.curp && u.curp.length > 0) {
      const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
      if (!curpRegex.test(u.curp.toUpperCase())) {
        return { valido: false, mensaje: 'El formato de CURP no es válido' };
      }
    }

    if (u.codigoPostal && u.codigoPostal.length > 0) {
      const cpRegex = /^[0-9]{5}$/;
      if (!cpRegex.test(u.codigoPostal)) {
        return { valido: false, mensaje: 'El código postal debe tener 5 dígitos numéricos' };
      }
    }

    if (u.peso && (u.peso < 10 || u.peso > 500)) {
      return { valido: false, mensaje: 'El peso debe estar entre 10 y 500 kg' };
    }

    if (u.altura && (u.altura < 0.5 || u.altura > 3)) {
      return { valido: false, mensaje: 'La altura debe estar entre 0.5 y 3 metros' };
    }

    return { valido: true, mensaje: '' };
  }

  ngOnDestroy() {
    this.destruirCalendariosCita();
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  volver() {
    this.location.back();
  }

  // --- CONTROL DEL TOAST NOTIFICACIÓN PREMIUM ---
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

  // --- CONTROL DEL MODAL Y FLATPICKR ---
  abrirModalCita() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    this.nuevaCita = {
      fechaCita: `${anio}-${mes}-${dia}`,
      horaCita: '10:00',
      motivo: '',
      sintomas: '',
      modalidad: 'Presencial'
    };

    this.mostrarModalCita = true;
    this.cdr.detectChanges();

    // Inicializar los calendarios después de que el DOM se actualice
    setTimeout(() => {
      this.inicializarCalendariosCita();
    }, 100);
  }

  cerrarModalCita() {
    this.destruirCalendariosCita();
    this.mostrarModalCita = false;
  }

  inicializarCalendariosCita() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.destruirCalendariosCita();

    setTimeout(() => {
      const hoy = new Date();
      const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

      const fechaElement = document.querySelector('#fechaCitaInput');
      const horaElement = document.querySelector('#horaCitaInput');

      if (fechaElement) {
        this.fpFechaInstance = flatpickr('#fechaCitaInput', {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevaCita.fechaCita || "today",
          minDate: "today",
          maxDate: fechaMaximaCita,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.fechaCita = dateStr;
            this.cdr.detectChanges();
          }
        });
      }

      if (horaElement) {
        this.fpHoraInstance = flatpickr('#horaCitaInput', {
          locale: Spanish,
          enableTime: true,
          noCalendar: true,
          dateFormat: "H:i",
          time_24hr: true,
          defaultDate: this.nuevaCita.horaCita || "10:00",
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.horaCita = dateStr;
            this.cdr.detectChanges();
          }
        });
      }
    }, 100);
  }

  destruirCalendariosCita() {
    if (this.fpFechaInstance) {
      try { this.fpFechaInstance.destroy(); } catch (e) { }
      this.fpFechaInstance = null;
    }
    if (this.fpHoraInstance) {
      try { this.fpHoraInstance.destroy(); } catch (e) { }
      this.fpHoraInstance = null;
    }
  }

  async registrarCita() {
    if (!this.nuevaCita.fechaCita || !this.nuevaCita.horaCita || !this.nuevaCita.motivo.trim()) {
      this.lanzarNotificacion("⚠️ Por favor rellene los campos obligatorios para agendar la cita.", "warning");
      return;
    }

    this.isSavingCita = true;
    try {
      const nombre = (this.usuarioSeleccionado.nombre || '').trim();
      const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || this.usuarioSeleccionado.apPaterno || '').trim();
      const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || this.usuarioSeleccionado.apMaterno || '').trim();

      const payloadCita = {
        nombrePaciente: nombre,
        apPaternoPaciente: apPaterno,
        apMaternoPaciente: apMaterno,
        telefonoPaciente: this.usuarioSeleccionado.telefono ? String(this.usuarioSeleccionado.telefono) : null,
        correoPaciente: this.usuarioSeleccionado.correo,
        fechaCita: this.nuevaCita.fechaCita,
        horaCita: this.nuevaCita.horaCita.length === 5 ? `${this.nuevaCita.horaCita}:00` : this.nuevaCita.horaCita,
        motivo: this.nuevaCita.motivo.trim(),
        sintomas: this.nuevaCita.sintomas.trim() || 'Sin síntomas',
        modalidad: this.nuevaCita.modalidad,
        estado: 'Programada'
      };

      await firstValueFrom(this.usersService.crearCita(payloadCita));
      await this.cargarDatosReales();

      this.cerrarModalCita();
      this.lanzarNotificacion("¡Cita asignada! Se registró la cita médica correctamente.", "success");

    } catch (error: any) {
      console.error("Error al registrar la cita:", error);
      this.lanzarNotificacion("❌ Hubo un error al registrar la cita médica.", "error");
    } finally {
      this.isSavingCita = false;
      this.cdr.detectChanges();
    }
  }

  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();

    if (!nombre || !apPaterno || !this.usuarioSeleccionado.correo) {
      this.lanzarNotificacion("⚠️ El nombre, apellido paterno y correo son obligatorios.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(`⚠️ ${validacion.mensaje}`, "warning");
      return;
    }

    this.isSaving = true;
    const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

    try {
      const pesoFinal = this.usuarioSeleccionado.peso !== undefined &&
        this.usuarioSeleccionado.peso !== null &&
        this.usuarioSeleccionado.peso !== ''
        ? Number(this.usuarioSeleccionado.peso)
        : null;

      const alturaFinal = this.usuarioSeleccionado.altura !== undefined &&
        this.usuarioSeleccionado.altura !== null &&
        this.usuarioSeleccionado.altura !== ''
        ? Number(this.usuarioSeleccionado.altura)
        : null;

      const datosPostgres = {
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        appaterno: apPaterno,
        apmaterno: apMaterno,
        correo: this.usuarioSeleccionado.correo,
        telefono: this.usuarioSeleccionado.telefono || null,
        genero: this.usuarioSeleccionado.genero || null,
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento || null,
        curp: (this.usuarioSeleccionado.curp || '').toUpperCase().trim() || null,
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim() || null,
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim() || null,
        localidad: (this.usuarioSeleccionado.localidad || '').trim() || null,
        municipio: (this.usuarioSeleccionado.municipio || '').trim() || null,
        estado: (this.usuarioSeleccionado.estado || '').trim() || null,
        nss: this.usuarioSeleccionado.nss || null,
        tipoSangre: this.usuarioSeleccionado.tipoSangre || null,
        peso: pesoFinal,
        altura: alturaFinal,
        antecedentesFamiliares: this.usuarioSeleccionado.antecedentesFamiliares || null,
        rol: 'Paciente',
        activo: this.usuarioSeleccionado.activo ?? true
      };

      await firstValueFrom(this.usersService.updateUsuario(id, datosPostgres));

      this.usuarioSeleccionado.nombre = nombre;
      this.usuarioSeleccionado.apPaterno = apPaterno;
      this.usuarioSeleccionado.apMaterno = apMaterno;
      this.usuarioSeleccionado.tempApellidoPaterno = apPaterno;
      this.usuarioSeleccionado.tempApellidoMaterno = apMaterno;
      this.usuarioSeleccionado.peso = pesoFinal;
      this.usuarioSeleccionado.altura = alturaFinal;

      this.lanzarNotificacion("¡Éxito! Los datos del paciente se actualizaron correctamente.", "success");

      this.agregarHistorial(
        'Datos actualizados',
        `Información del paciente actualizada por el usuario`
      );

      setTimeout(() => {
        this.router.navigate(['/pacientes']);
      }, 2000);

    } catch (error: any) {
      console.error('Error al actualizar:', error);
      this.lanzarNotificacion("❌ No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }
}