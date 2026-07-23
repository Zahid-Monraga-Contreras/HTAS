import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleService } from '../../../../../../core/services/google.service';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// Importar los partials
import { InfoPacienteComponent } from './partials/info-paciente/info-paciente';
import { HistorialPacienteComponent } from './partials/historial-paciente/historial-paciente';
import { ExpedientePacienteComponent } from './partials/expediente-paciente/expediente-paciente';
import { AnalisisPacienteComponent } from './partials/analisis-paciente/analisis-paciente';

type TabPaciente = 'info' | 'historial' | 'expediente' | 'analisis';

@Component({
  selector: 'app-paciente-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Menu,
    InfoPacienteComponent,
    HistorialPacienteComponent,
    ExpedientePacienteComponent,
    AnalisisPacienteComponent
  ],
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

  // ============================================================
  // ESTADO GLOBAL
  // ============================================================
  usuarioSeleccionado: any = null;
  isSaving = false;
  activeTab: TabPaciente = 'info';

  // Datos del paciente (cargados por este componente)
  historialCambios: any[] = [];
  citasPaciente: any[] = [];
  estadisticas: any = null;
  ultimaMedicion: any = null;
  pacienteId: number | null = null;

  // ============================================================
  // NOTIFICACIONES (TOAST)
  // ============================================================
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // ============================================================
  // MODAL DE CITAS
  // ============================================================
  mostrarModalCita = false;
  isSavingCita = false;
  nuevaCita = {
    fechaCita: '',
    horaCita: '',
    motivo: '',
    sintomas: '',
    modalidad: 'Presencial'
  };

  private fpFechaInstance: any = null;
  private fpHoraInstance: any = null;

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================
  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const state = history.state;

    if (state && state.usuario) {
      this.pacienteId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();
      this.cargarDatosCompletosPaciente();
      this.cargarDatosReales();
      this.cargarUltimaMedicionExpediente();
    } else {
      this.router.navigate(['/pacientes']);
    }
  }

  ngOnDestroy() {
    this.destruirCalendariosCita();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  // ============================================================
  // NAVEGACIÓN
  // ============================================================
  cambiarTab(tab: TabPaciente) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  volver() {
    this.location.back();
  }

  // ============================================================
  // INICIALIZACIÓN DE CAMPOS
  // ============================================================
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

  // ============================================================
  // CARGA DE DATOS (ÚNICO LUGAR DONDE SE CARGAN)
  // ============================================================
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

  async cargarDatosReales() {
    if (!this.usuarioSeleccionado?.correo) return;

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
        this.generarHistorialVacio();
      }

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
      this.generarHistorialVacio();
    } finally {
      this.cdr.detectChanges();
    }
  }

  async cargarUltimaMedicionExpediente() {
    if (!this.pacienteId) return;

    try {
      const medicion = await firstValueFrom(
        this.usersService.getUltimaMedicionPaciente(this.pacienteId)
      );
      if (medicion && Object.keys(medicion).length > 0) {
        const fechaFormateada = medicion.fechahoralectura || medicion.FechaHoraLectura || 'Fecha no disponible';

        this.ultimaMedicion = {
          sistolica: medicion.sistolica || medicion.Sistolica || 0,
          diastolica: medicion.diastolica || medicion.Diastolica || 0,
          pulso: medicion.pulso || medicion.Pulso || 0,
          fechahoralectura: this.extraerSoloFecha(String(fechaFormateada))
        };
      } else {
        this.ultimaMedicion = null;
      }
    } catch (error) {
      console.warn('No se pudo cargar la ultima medicion:', error);
      this.ultimaMedicion = null;
    } finally {
      this.cdr.detectChanges();
    }
  }

  // ============================================================
  // CÁLCULOS Y FORMATEOS
  // ============================================================
  private extraerSoloFecha(fechaStr: string): string {
    if (!fechaStr) return 'Fecha no disponible';

    if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaStr)) {
      return fechaStr;
    }

    try {
      const date = new Date(fechaStr);
      if (!isNaN(date.getTime())) {
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const anio = date.getFullYear();
        return `${dia}/${mes}/${anio}`;
      }
    } catch (e) { }

    const match = fechaStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]}`;
    }

    return 'Fecha no disponible';
  }

  calcularEstadisticas(citas: any[]) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const completadas = citas.filter(c => c.estado === 'Completada');
    const pendientes = citas.filter(c =>
      c.estado === 'Programada' || c.estado === 'Confirmada'
    );
    const canceladas = citas.filter(c => c.estado === 'Cancelada' || c.estado === 'No Asistio');

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

  generarHistorialDesdeCitas(citas: any[]) {
    const historial: any[] = [];

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
        case 'No Asistio':
          accion = 'No asistio';
          detalle = `No asistio a cita del ${fechaFormateada}`;
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
      this.generarHistorialVacio();
    } else {
      this.historialCambios = historial;
    }
  }

  generarHistorialVacio() {
    const fechaActual = new Date();
    const fechaStr = fechaActual.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.historialCambios = [{
      fecha: fechaStr,
      accion: 'Paciente registrado',
      detalle: `Registrado: ${this.usuarioSeleccionado?.nombre || ''} ${this.usuarioSeleccionado?.apPaterno || ''}`,
      usuario: 'Sistema'
    }];
  }

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

  // ============================================================
  // COMUNICACIÓN CON PARTIALS
  // ============================================================

  // Eventos desde InfoPaciente
  onInfoVolver() {
    this.volver();
  }

  onInfoGuardarCambios() {
    this.guardarCambios();
  }

  onInfoCambioDatos() {
    this.cdr.detectChanges();
  }

  onInfoAbrirModalCita() {
    this.abrirModalCita();
  }

  // Eventos desde HistorialPaciente
  onHistorialCargado(event: { citas: any[], estadisticas: any, historial: any[] }) {
    this.cdr.detectChanges();
  }

  // Eventos desde ExpedientePaciente
  onExpedienteMedicionCargada(medicion: any) {
    this.ultimaMedicion = medicion;
    this.cdr.detectChanges();
  }

  // Eventos desde AnalisisPaciente
  onAnalisisNotificacion(event: { mensaje: string; tipo: 'success' | 'error' | 'warning' }) {
    this.lanzarNotificacion(event.mensaje, event.tipo);
  }

  // ============================================================
  // MODAL DE CITAS (Gestionado por el padre)
  // ============================================================
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
        import('flatpickr').then(module => {
          const flatpickr = module.default;
          import('flatpickr/dist/l10n/es.js').then(esModule => {
            this.fpFechaInstance = flatpickr('#fechaCitaInput', {
              locale: esModule.Spanish,
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
          });
        });
      }

      if (horaElement) {
        import('flatpickr').then(module => {
          const flatpickr = module.default;
          import('flatpickr/dist/l10n/es.js').then(esModule => {
            this.fpHoraInstance = flatpickr('#horaCitaInput', {
              locale: esModule.Spanish,
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
          });
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
      this.lanzarNotificacion("Por favor rellene los campos obligatorios para agendar la cita.", "warning");
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
        sintomas: this.nuevaCita.sintomas.trim() || 'Sin sintomas',
        modalidad: this.nuevaCita.modalidad,
        estado: 'Programada'
      };

      await firstValueFrom(this.usersService.crearCita(payloadCita));

      this.cerrarModalCita();
      this.lanzarNotificacion("Cita asignada. Se registro la cita medica correctamente.", "success");

      // RECARGAR DATOS DESPUÉS DE CREAR LA CITA
      await this.cargarDatosReales();

    } catch (error: any) {
      console.error("Error al registrar la cita:", error);
      this.lanzarNotificacion("Hubo un error al registrar la cita medica.", "error");
    } finally {
      this.isSavingCita = false;
      this.cdr.detectChanges();
    }
  }

  // ============================================================
  // GUARDAR CAMBIOS DEL PACIENTE
  // ============================================================
  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();

    if (!nombre || !apPaterno || !this.usuarioSeleccionado.correo) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo son obligatorios.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
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

      // Actualizar el objeto local después de guardar
      this.usuarioSeleccionado.nombre = nombre;
      this.usuarioSeleccionado.apPaterno = apPaterno;
      this.usuarioSeleccionado.apMaterno = apMaterno;
      this.usuarioSeleccionado.tempApellidoPaterno = apPaterno;
      this.usuarioSeleccionado.tempApellidoMaterno = apMaterno;
      this.usuarioSeleccionado.peso = pesoFinal;
      this.usuarioSeleccionado.altura = alturaFinal;

      this.lanzarNotificacion("Los datos del paciente se actualizaron correctamente.", "success");

      this.agregarHistorial(
        'Datos actualizados',
        'Informacion del paciente actualizada por el usuario'
      );

      // RECARGAR DATOS COMPLETOS PARA REFRESCAR TODO
      await this.cargarDatosCompletosPaciente();
      await this.cargarDatosReales();

      setTimeout(() => {
        this.router.navigate(['/pacientes']);
      }, 2000);

    } catch (error: any) {
      console.error('Error al actualizar:', error);
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // ============================================================
  // VALIDAR CAMPOS
  // ============================================================
  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.nombre || u.nombre.trim().length < 2) {
      return { valido: false, mensaje: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (!u.tempApellidoPaterno || u.tempApellidoPaterno.trim().length < 2) {
      return { valido: false, mensaje: 'El apellido paterno debe tener al menos 2 caracteres' };
    }

    if (!u.correo || !u.correo.includes('@')) {
      return { valido: false, mensaje: 'El correo electronico no es valido' };
    }

    if (u.curp && u.curp.length > 0) {
      const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
      if (!curpRegex.test(u.curp.toUpperCase())) {
        return { valido: false, mensaje: 'El formato de CURP no es valido' };
      }
    }

    if (u.codigoPostal && u.codigoPostal.length > 0) {
      const cpRegex = /^[0-9]{5}$/;
      if (!cpRegex.test(u.codigoPostal)) {
        return { valido: false, mensaje: 'El codigo postal debe tener 5 digitos numericos' };
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

  // ============================================================
  // AGREGAR HISTORIAL
  // ============================================================
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

  // ============================================================
  // NOTIFICACIONES
  // ============================================================
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

  // ============================================================
  // ESTADO DEL PACIENTE (Para el header)
  // ============================================================
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
}