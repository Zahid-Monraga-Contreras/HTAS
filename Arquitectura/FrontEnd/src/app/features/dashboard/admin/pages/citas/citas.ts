import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

declare var flatpickr: any;

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [Menu, CommonModule, FormsModule],
  templateUrl: './citas.html',
  styleUrl: './citas.css',
})
export class Citas implements OnInit, OnDestroy {
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  citasTodo: any[] = [];
  searchTerm: string = '';
  expandedId: number | null = null;
  currentUser: any = null;

  canAdd: boolean = true;
  canEdit: boolean = true;
  canDelete: boolean = true;

  paginaActual = 0;
  itemsPorPagina = 10;

  citaSeleccionada: any = null;
  mostrarModalCrear = false;
  mostrarModalEdit = false;
  mostrarModalDelete = false;
  isSaving = false;
  isDeleting = false;

  // Variables para disponibilidad
  horarioDisponible: boolean = true;
  mensajeDisponibilidad: string = '';
  horariosDisponibles: string[] = [];
  mostrandoHorarios: boolean = false;
  horarioSeleccionadoValido: boolean = true;
  verificandoDisponibilidad: boolean = false;

  // Variables para búsqueda de doctores y pacientes
  loadingDoctores = false;
  loadingPacientes = false;
  doctores: any[] = [];
  doctoresFiltrados: any[] = [];
  pacientes: any[] = [];
  pacientesFiltrados: any[] = [];
  searchDoctorTerm: string = '';
  searchPacienteTerm: string = '';

  nuevaCita: any = {
    fecha: '',
    hora: '',
    motivo: '',
    modalidad: 'Presencial',
    sintomas: '',
    idDoctor: null,
    idPaciente: null,
    nombreDoctor: '',
    nombrePaciente: ''
  };

  private fpFechaInstance: any = null;
  private fpHoraInstance: any = null;

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.canAdd = params['canAdd'] !== 'false';
      this.canEdit = params['canEdit'] !== 'false';
      this.canDelete = params['canDelete'] !== 'false';
      console.log('Permisos Citas:', { canAdd: this.canAdd, canEdit: this.canEdit, canDelete: this.canDelete });
    });

    if (isPlatformBrowser(this.platformId)) {
      await this.obtenerUsuario();

      if (this.currentUser && this.currentUser.correo) {
        console.log('Usuario cargado correctamente:', this.currentUser.correo);
        console.log('Rol del usuario:', this.currentUser.rol);
        await this.cargarCitas();
        await this.cargarDoctores();
        await this.cargarPacientes();
      } else {
        console.error('No se pudo obtener el usuario');
      }
    }
  }

  private async obtenerUsuario(): Promise<void> {
    try {
      const uService = this.usersService as any;
      if (uService.currentUserSubject && uService.currentUserSubject.value) {
        const user = uService.currentUserSubject.value;
        console.log('Usuario desde UsersService:', user);
        if (user && (user.correo || user.email)) {
          this.currentUser = {
            ...user,
            correo: user.correo || user.email,
            nombre: user.nombre || user.displayName,
            rol: user.rol || 'Paciente'
          };
          return;
        }
      }

      const saved = localStorage.getItem('user_htas');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Usuario desde localStorage:', parsed);
        if (parsed && parsed.correo) {
          this.currentUser = parsed;
          return;
        }
      }

      if (uService.cargarSesionPersistente) {
        uService.cargarSesionPersistente();
        const user = uService.currentUserSubject?.value;
        if (user && (user.correo || user.email)) {
          console.log('Usuario desde sesion persistente:', user);
          this.currentUser = {
            ...user,
            correo: user.correo || user.email
          };
          return;
        }
      }

      console.warn('No se encontro usuario en ninguna fuente');
      this.currentUser = null;
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      this.currentUser = null;
    }
  }

  ngOnDestroy() {
    this.destruirCalendarios();
  }

  async cargarCitas() {
    if (!this.currentUser || !this.currentUser.correo) {
      console.error('Usuario o correo no disponible');
      await this.obtenerUsuario();
      if (!this.currentUser || !this.currentUser.correo) {
        return;
      }
    }

    console.log('=== INICIANDO CARGA DE CITAS ===');
    console.log('Usuario actual:', this.currentUser.correo);
    console.log('Rol del usuario:', this.currentUser.rol);

    const rol = this.currentUser.rol.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const esAdmin = rol === 'administrador' ||
      rol === 'admin' ||
      this.currentUser.rol?.toLowerCase().includes('admin') ||
      this.currentUser.rol?.toLowerCase() === 'administrador';

    const esMedico = rol.includes('medico') || rol.includes('doctor');
    const esAcompanante = rol === 'acompanante';

    const tieneAccesoGlobal = esAdmin || esMedico || esAcompanante;

    let data: any[] = [];

    try {
      if (tieneAccesoGlobal) {
        console.log('Cargando TODAS las citas (getAllCitas)');
        const response = await firstValueFrom(this.usersService.getAllCitas());
        console.log('Respuesta getAllCitas:', response);

        if (response && Array.isArray(response)) {
          data = response;
        } else if (response && typeof response === 'object') {
          const keys = ['data', 'citas', 'results', 'items', 'rows'];
          for (const key of keys) {
            if (response[key] && Array.isArray(response[key])) {
              data = response[key];
              console.log('Datos encontrados en "' + key + '":', data.length);
              break;
            }
          }
          if (data.length === 0) {
            data = Object.values(response).filter(v => Array.isArray(v)).flat() || [];
          }
        }
      } else {
        console.log('Cargando SOLO citas del paciente (getMisCitas)');
        const response = await firstValueFrom(this.usersService.getMisCitas(this.currentUser.correo));
        console.log('Respuesta getMisCitas:', response);

        if (response && Array.isArray(response)) {
          data = response;
        } else if (response && typeof response === 'object') {
          const keys = ['data', 'citas', 'results', 'items', 'rows'];
          for (const key of keys) {
            if (response[key] && Array.isArray(response[key])) {
              data = response[key];
              break;
            }
          }
        }
      }

      console.log('Total de citas cargadas:', data.length);

      this.citasTodo = data.map(c => ({
        ...c,
        id: c.idcita || c.id,
        NombreMostrar: c.nombrepaciente || c.paciente || c.NombreMostrar || 'Paciente sin nombre'
      }));

      console.log('citasTodo actualizado. Total:', this.citasTodo.length);

      this.cdr.detectChanges();

      if (this.citasTodo.length === 0) {
        console.warn('No se encontraron citas para mostrar');
      }

    } catch (error) {
      console.error('Error al cargar citas:', error);
      this.citasTodo = [];
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // CARGAR DOCTORES
  // ==========================================
  async cargarDoctores() {
    this.loadingDoctores = true;
    try {
      const allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());
      if (Array.isArray(allUsers)) {
        this.doctores = allUsers.filter(u =>
          u.rol?.toLowerCase() === 'doctor' && u.activo !== false
        );
        this.doctoresFiltrados = [...this.doctores];
        console.log('Doctores cargados:', this.doctores.length);
      }
    } catch (error) {
      console.error('Error al cargar doctores:', error);
    } finally {
      this.loadingDoctores = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // CARGAR PACIENTES
  // ==========================================
  async cargarPacientes() {
    this.loadingPacientes = true;
    try {
      const allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());
      if (Array.isArray(allUsers)) {
        this.pacientes = allUsers.filter(u =>
          u.rol?.toLowerCase() === 'paciente' && u.activo !== false
        );
        this.pacientesFiltrados = [...this.pacientes];
        console.log('Pacientes cargados:', this.pacientes.length);
      }
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
    } finally {
      this.loadingPacientes = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // BUSCAR DOCTORES
  // ==========================================
  buscarDoctores() {
    const term = this.searchDoctorTerm.toLowerCase().trim();
    if (!term) {
      this.doctoresFiltrados = [...this.doctores];
      return;
    }
    this.doctoresFiltrados = this.doctores.filter(d =>
      d.nombre?.toLowerCase().includes(term) ||
      d.apPaterno?.toLowerCase().includes(term) ||
      d.correo?.toLowerCase().includes(term) ||
      d.especialidad?.toLowerCase().includes(term)
    );
  }

  // ==========================================
  // BUSCAR PACIENTES
  // ==========================================
  buscarPacientes() {
    const term = this.searchPacienteTerm.toLowerCase().trim();
    if (!term) {
      this.pacientesFiltrados = [...this.pacientes];
      return;
    }
    this.pacientesFiltrados = this.pacientes.filter(p =>
      p.nombre?.toLowerCase().includes(term) ||
      p.apPaterno?.toLowerCase().includes(term) ||
      p.correo?.toLowerCase().includes(term)
    );
  }

  // ==========================================
  // SELECCIONAR DOCTOR
  // ==========================================
  seleccionarDoctor(doctor: any) {
    this.nuevaCita.idDoctor = doctor.idusuario;
    this.nuevaCita.nombreDoctor = `${doctor.nombre} ${doctor.apPaterno}`;
    this.searchDoctorTerm = `${doctor.nombre} ${doctor.apPaterno}`;
    this.doctoresFiltrados = [];
    this.cdr.detectChanges();
  }

  // ==========================================
  // SELECCIONAR PACIENTE
  // ==========================================
  seleccionarPaciente(paciente: any) {
    this.nuevaCita.idPaciente = paciente.idusuario;
    this.nuevaCita.nombrePaciente = `${paciente.nombre} ${paciente.apPaterno}`;
    this.searchPacienteTerm = `${paciente.nombre} ${paciente.apPaterno}`;
    this.pacientesFiltrados = [];
    this.cdr.detectChanges();
  }

  get citasFiltradas() {
    if (!this.searchTerm) return this.citasTodo;
    const term = this.searchTerm.toLowerCase();
    return this.citasTodo.filter(c =>
      c.NombreMostrar?.toLowerCase().includes(term) ||
      c.motivo?.toLowerCase().includes(term) ||
      c.estado?.toLowerCase().includes(term)
    );
  }

  get citasPaginadas() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.citasFiltradas.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const totalPaginas = Math.ceil(this.citasFiltradas.length / this.itemsPorPagina);
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  seleccionarCita(c: any) {
    console.log('Seleccionando cita:', c.idcita || c.id);
    this.citaSeleccionada = {
      ...c,
      tempEstado: c.estado,
      notasdoctor: c.notasdoctor || ''
    };
  }

  // ==========================================
  // ABRIR CREAR CITA CON VALIDACION
  // ==========================================
  abrirCrearCita() {
    if (!this.canAdd) {
      return;
    }

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    // Resetear variables
    this.horarioDisponible = true;
    this.mensajeDisponibilidad = '';
    this.horariosDisponibles = [];
    this.mostrandoHorarios = false;
    this.horarioSeleccionadoValido = true;
    this.verificandoDisponibilidad = false;
    this.searchDoctorTerm = '';
    this.searchPacienteTerm = '';
    this.doctoresFiltrados = [];
    this.pacientesFiltrados = [];

    this.nuevaCita = {
      fecha: anio + '-' + mes + '-' + dia,
      hora: '10:00',
      motivo: '',
      modalidad: 'Presencial',
      sintomas: '',
      idDoctor: null,
      idPaciente: null,
      nombreDoctor: '',
      nombrePaciente: ''
    };

    this.mostrarModalCrear = true;
    this.cdr.detectChanges();
    setTimeout(() => this.inicializarCalendario(), 100);
  }

  // ==========================================
  // VERIFICAR DISPONIBILIDAD
  // ==========================================
  private async verificarDisponibilidadEnTiempoReal() {
    const fecha = this.nuevaCita.fecha;
    const hora = this.nuevaCita.hora;

    if (!fecha || !hora) {
      this.horarioDisponible = true;
      this.mensajeDisponibilidad = '';
      this.horarioSeleccionadoValido = true;
      return;
    }

    this.verificandoDisponibilidad = true;
    this.cdr.detectChanges();

    try {
      const disponibilidad = await firstValueFrom(
        this.usersService.verificarDisponibilidad(fecha, hora + ':00', this.currentUser?.correo)
      );

      this.horarioDisponible = disponibilidad.disponible;
      this.mensajeDisponibilidad = disponibilidad.mensaje;

      if (!disponibilidad.disponible) {
        this.horarioSeleccionadoValido = false;

        if (disponibilidad.detalles) {
          const detalles = disponibilidad.detalles;
          if (detalles.usuarioYaTieneCita) {
            this.showToast('warning', 'Ya tiene cita', 'El paciente ya tiene una cita agendada para esta fecha y hora.');
          } else if (detalles.horaLlena) {
            this.showToast('warning', 'Horario completo', 'Este horario ya está completo (3 citas agendadas).');
          } else if (detalles.limiteDiaAlcanzado) {
            this.showToast('warning', 'Límite diario alcanzado', 'El paciente ya tiene 2 citas para este día.');
          } else if (detalles.yaAgendado) {
            this.showToast('warning', 'Horario ocupado', `Este horario ya está ocupado por ${detalles.correoExistente || 'otro usuario'}.`);
          }
        }
      } else {
        this.horarioSeleccionadoValido = true;
        this.showToast('info', 'Horario disponible', 'El horario está disponible para agendar.');
      }

    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      this.showToast('warning', 'Error de verificación', 'No se pudo verificar la disponibilidad. Intenta nuevamente.');
    } finally {
      this.verificandoDisponibilidad = false;
      this.cdr.detectChanges();
    }
  }

  private async cargarHorariosDisponibles(fecha: string) {
    if (!fecha) {
      this.horariosDisponibles = [];
      this.mostrandoHorarios = false;
      return;
    }

    try {
      const response = await firstValueFrom(
        this.usersService.getHorariosDisponibles(fecha, this.currentUser?.correo)
      );

      if (response && response.success) {
        this.horariosDisponibles = response.horariosDisponibles || [];
        this.mostrandoHorarios = this.horariosDisponibles.length > 0;

        if (this.horariosDisponibles.length === 1) {
          const horaSugerida = this.horariosDisponibles[0];
          this.seleccionarHorario(horaSugerida);
          this.showToast('info', 'Horario sugerido', `Solo hay un horario disponible: ${this.formatearHora(horaSugerida)}`);
        } else if (this.horariosDisponibles.length === 0) {
          this.showToast('warning', 'Sin horarios', 'No hay horarios disponibles para esta fecha.');
          this.mostrandoHorarios = false;
        }
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error cargando horarios disponibles:', error);
      this.mostrandoHorarios = false;
    }
  }

  seleccionarHorario(hora: string) {
    this.nuevaCita.hora = hora;

    if (this.fpHoraInstance) {
      try {
        const hoy = new Date();
        const [h, m] = hora.split(':').map(Number);
        hoy.setHours(h, m, 0, 0);
        this.fpHoraInstance.setDate(hoy, false);
      } catch (e) {
        console.warn('Error actualizando flatpickr hora:', e);
      }
    }

    this.verificarDisponibilidadEnTiempoReal();
    this.cdr.detectChanges();
  }

  formatearHora(hora: string): string {
    if (!hora) return 'S/H';
    try {
      const partes = hora.split(':');
      if (partes.length >= 2) {
        let h = parseInt(partes[0]);
        const m = partes[1];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      }
      return hora;
    } catch {
      return hora;
    }
  }

  // ==========================================
  // GUARDAR NUEVA CITA CON VALIDACION
  // ==========================================
  async guardarNuevaCita() {
    if (!this.canAdd) {
      return;
    }

    if (!this.nuevaCita.fecha || !this.nuevaCita.hora || !this.nuevaCita.motivo.trim()) {
      this.showToast('warning', 'Formulario Incompleto', 'Por favor, completa todos los campos requeridos.');
      return;
    }

    if (!this.nuevaCita.idDoctor) {
      this.showToast('warning', 'Doctor requerido', 'Por favor, selecciona un doctor para la cita.');
      return;
    }

    if (!this.nuevaCita.idPaciente) {
      this.showToast('warning', 'Paciente requerido', 'Por favor, selecciona un paciente para la cita.');
      return;
    }

    if (!this.horarioDisponible || !this.horarioSeleccionadoValido) {
      this.showToast('warning', 'Horario no disponible', this.mensajeDisponibilidad || 'El horario seleccionado no está disponible.');
      return;
    }

    this.isSaving = true;

    // Obtener datos completos del paciente seleccionado
    const pacienteSeleccionado = this.pacientes.find(p => p.idusuario === this.nuevaCita.idPaciente);

    // Verificar disponibilidad una última vez
    try {
      const disponibilidadFinal = await firstValueFrom(
        this.usersService.verificarDisponibilidad(
          this.nuevaCita.fecha,
          this.nuevaCita.hora + ':00',
          this.currentUser?.correo
        )
      );

      if (!disponibilidadFinal.disponible) {
        this.showToast('error', 'Horario ocupado', disponibilidadFinal.mensaje || 'El horario ya no está disponible.');
        this.horarioDisponible = false;
        this.horarioSeleccionadoValido = false;
        this.isSaving = false;
        this.cargarHorariosDisponibles(this.nuevaCita.fecha);
        return;
      }
    } catch (error) {
      console.error('Error verificando disponibilidad final:', error);
    }

    const citaParaEnviar = {
      nombrePaciente: pacienteSeleccionado?.nombre || 'Paciente',
      apPaternoPaciente: pacienteSeleccionado?.apPaterno || '',
      apMaternoPaciente: pacienteSeleccionado?.apMaterno || '',
      telefonoPaciente: pacienteSeleccionado?.telefono ? String(pacienteSeleccionado.telefono) : null,
      correoPaciente: pacienteSeleccionado?.correo || '',
      fechaCita: this.nuevaCita.fecha,
      horaCita: this.nuevaCita.hora.length === 5 ? this.nuevaCita.hora + ':00' : this.nuevaCita.hora,
      motivo: this.nuevaCita.motivo.trim(),
      modalidad: this.nuevaCita.modalidad,
      sintomas: this.nuevaCita.sintomas.trim() || 'Sin sintomas',
      estado: 'Programada'
    };

    try {
      await firstValueFrom(this.usersService.crearCita(citaParaEnviar));
      await this.cargarCitas();
      this.showToast('success', 'Cita Agendada', 'La cita ha sido agendada exitosamente.');
      this.cerrarModal();
    } catch (error: any) {
      console.error('Error al guardar cita:', error);
      let mensajeError = 'Ocurrió un error al agendar la cita.';
      if (error.error?.error) {
        mensajeError = error.error.error;
      }
      this.showToast('error', 'Error al Agendar', mensajeError);
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // TOAST DE NOTIFICACION
  // ==========================================
  private showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) {
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  }

  abrirEditarCita() {
    if (!this.canEdit) {
      return;
    }
    if (!this.citaSeleccionada) {
      return;
    }
    const id = this.citaSeleccionada.idcita || this.citaSeleccionada.id;
    this.router.navigate(['/admin/citas/editar', id], { state: { cita: this.citaSeleccionada } });
  }

  abrirEliminarCita() {
    if (!this.canDelete) {
      return;
    }
    if (!this.citaSeleccionada) {
      return;
    }
    this.mostrarModalDelete = true;
  }

  async confirmarEliminarCita() {
    if (!this.canDelete) {
      return;
    }

    if (!this.citaSeleccionada) {
      return;
    }

    if (this.citaSeleccionada.estado === 'Cancelada') {
      this.cerrarModal();
      return;
    }

    if (this.citaSeleccionada.estado === 'Completada') {
      this.cerrarModal();
      return;
    }

    this.isDeleting = true;

    try {
      const idCita = this.citaSeleccionada.idcita || this.citaSeleccionada.id;

      await firstValueFrom(
        this.usersService.cancelarCita(idCita, 'Cancelada por el usuario')
      );

      await this.cargarCitas();
      this.cerrarModal();
      this.citaSeleccionada = null;
    } catch (error: any) {
      console.error('Error al cancelar:', error);
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  toggleExpand(id: number, event: Event) {
    event.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }

  cerrarModal() {
    this.destruirCalendarios();
    this.mostrarModalCrear = false;
    this.mostrarModalEdit = false;
    this.mostrarModalDelete = false;
    this.horariosDisponibles = [];
    this.mostrandoHorarios = false;
    this.doctoresFiltrados = [];
    this.pacientesFiltrados = [];
  }

  // ==========================================
  // CALENDARIO CON VALIDACION
  // ==========================================
  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        this.destruirCalendarios();

        this.fpFechaInstance = flatpickr("#fechaCitaInput", {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevaCita.fecha || "today",
          minDate: "today",
          maxDate: fechaMaximaCita,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.fecha = dateStr;
            this.cargarHorariosDisponibles(dateStr);
            this.verificarDisponibilidadEnTiempoReal();
            this.cdr.detectChanges();
          }
        });

        this.fpHoraInstance = flatpickr("#horaCitaInput", {
          locale: Spanish,
          enableTime: true,
          noCalendar: true,
          dateFormat: "H:i",
          time_24hr: true,
          defaultDate: this.nuevaCita.hora || "10:00",
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.hora = dateStr;
            this.verificarDisponibilidadEnTiempoReal();
            this.cdr.detectChanges();
          }
        });

        if (this.nuevaCita.fecha) {
          this.cargarHorariosDisponibles(this.nuevaCita.fecha);
        }
      }, 100);
    }
  }

  destruirCalendarios() {
    if (this.fpFechaInstance) {
      this.fpFechaInstance.destroy();
      this.fpFechaInstance = null;
    }
    if (this.fpHoraInstance) {
      this.fpHoraInstance.destroy();
      this.fpHoraInstance = null;
    }
  }

  // ==========================================
  // AVATAR URL
  // ==========================================
  getAvatarUrl(nombre: string, apPaterno: string): string {
    const name = `${nombre || ''} ${apPaterno || ''}`.trim();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
  }
}