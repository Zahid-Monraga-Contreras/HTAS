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

  nuevaCita: any = {
    fecha: '',
    hora: '',
    motivo: '',
    modalidad: 'Presencial',
    sintomas: ''
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

    console.log('Rol normalizado:', rol);

    const esAdmin = rol === 'administrador' ||
      rol === 'admin' ||
      this.currentUser.rol?.toLowerCase().includes('admin') ||
      this.currentUser.rol?.toLowerCase() === 'administrador';

    const esMedico = rol.includes('medico') || rol.includes('doctor');
    const esAcompanante = rol === 'acompanante';

    const tieneAccesoGlobal = esAdmin || esMedico || esAcompanante;

    console.log('Resultado de verificacion:');
    console.log('  - esAdmin:', esAdmin);
    console.log('  - esMedico:', esMedico);
    console.log('  - esAcompanante:', esAcompanante);
    console.log('  - tieneAccesoGlobal:', tieneAccesoGlobal);

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

  abrirCrearCita() {
    if (!this.canAdd) {
      return;
    }

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    this.nuevaCita = {
      fecha: anio + '-' + mes + '-' + dia,
      hora: '10:00',
      motivo: '',
      modalidad: 'Presencial',
      sintomas: ''
    };
    this.mostrarModalCrear = true;
    this.cdr.detectChanges();
    this.inicializarCalendario();
  }

  async guardarNuevaCita() {
    if (!this.canAdd) {
      return;
    }

    if (!this.nuevaCita.fecha || !this.nuevaCita.hora || !this.nuevaCita.motivo.trim()) {
      return;
    }

    this.isSaving = true;

    const citaParaEnviar = {
      nombrePaciente: this.currentUser.nombre || this.currentUser.NombreCompleto || 'Paciente',
      apPaternoPaciente: this.currentUser.apPaterno || '',
      apMaternoPaciente: this.currentUser.apMaterno || '',
      telefonoPaciente: this.currentUser.telefono ? String(this.currentUser.telefono) : null,
      correoPaciente: this.currentUser.correo,
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
      this.cerrarModal();
    } catch (error) {
      console.error('Error al guardar cita:', error);
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
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
  }

  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

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
            this.cdr.detectChanges();
          }
        });
      }, 50);
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
}