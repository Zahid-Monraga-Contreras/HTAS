import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GoogleService } from '../../../../../../core/services/google.service';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

import { InfoAcompanante } from './partials/info-acompanante/info-acompanante';
import { HistorialAcompanante, HistorialItem } from './partials/historial-acompanante/historial-acompanante';
import { ExpedienteAcompanante } from './partials/expediente-acompanante/expediente-acompanante';

type TabAcompanante = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-acompanante-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu, InfoAcompanante, HistorialAcompanante, ExpedienteAcompanante],
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

  activeTab: TabAcompanante = 'info';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  historialCambios: HistorialItem[] = [];
  visitasAcompanante: any[] = [];

  estadisticas: {
    totalVisitas: number;
    visitasCompletadas: number;
    visitasPendientes: number;
    visitasCanceladas: number;
    ultimaVisita: string | null;
    proximaVisita: string | null;
  } | null = null;

  acompananteId: number | null = null;
  fechaGeneracion = '';
  pacientesAsignadosIds: number[] = [];
  pacientesAsignadosEmails: string[] = [];

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

  descargarExpedientePDF() {
    // Método descargarExpedientePDF
  }

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

    } else {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/admin/acompanantes']);
      }
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  cambiarTab(tab: TabAcompanante) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

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
      // Error silencioso
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

  private async cargarPacientesAsignados() {
    if (!this.acompananteId) {
      return;
    }

    try {
      let pacientesData: any[] = [];
      let response: any = null;

      try {
        response = await firstValueFrom(
          this.usersService.getPacientesAsignados(this.acompananteId)
        );
      } catch (err) {
        // Error silencioso
      }

      if (response) {
        if (response.success !== undefined && response.data !== undefined) {
          pacientesData = response.data || [];
        } else if (response.data !== undefined) {
          pacientesData = response.data || [];
        } else if (Array.isArray(response)) {
          pacientesData = response;
        } else if (typeof response === 'object') {
          for (const key in response) {
            if (Array.isArray(response[key]) && response[key].length > 0) {
              pacientesData = response[key];
              break;
            }
          }
        }
      }

      this.pacientesAsignadosIds = pacientesData
        .map((p: any) => {
          const id = p.id_usuario || p.IdUsuario || p.idusuario || p.id || p.IdPaciente || p.idpaciente || p.pacienteId;
          return typeof id === 'string' ? parseInt(id, 10) : id;
        })
        .filter((id: number) => id > 0);

      this.pacientesAsignadosEmails = pacientesData
        .map((p: any) => p.correo || p.Correo || p.email || p.Email || '')
        .filter((email: string) => email && email.length > 0);

    } catch (error: any) {
      this.pacientesAsignadosIds = [];
      this.pacientesAsignadosEmails = [];
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Fecha no disponible';
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;

      const hoy = new Date();
      const diff = hoy.getTime() - d.getTime();
      const minutos = Math.floor(diff / 60000);
      const horas = Math.floor(diff / 3600000);
      const dias = Math.floor(diff / 86400000);

      if (minutos < 1) return 'Hace unos segundos';
      if (minutos < 60) return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
      if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
      if (dias < 7) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;

      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  async cargarDatosReales() {
    if (!this.acompananteId) return;

    try {
      await this.cargarPacientesAsignados();

      const [citas, usuarios] = await Promise.all([
        firstValueFrom(this.usersService.getAllCitas()).catch(() => []),
        firstValueFrom(this.usersService.getUsuariosBackend()).catch(() => [])
      ]);

      const citasFiltradas = Array.isArray(citas)
        ? citas.filter((c: any) => {
          const posiblesIds = [
            c.idpaciente, c.IdPaciente, c.idPaciente,
            c.pacienteId, c.id_usuario, c.IdUsuario,
            c.idusuario, c.paciente_id, c.paciente
          ];

          let idPacienteCita = null;
          for (const pid of posiblesIds) {
            if (pid !== undefined && pid !== null && pid !== '') {
              idPacienteCita = pid;
              break;
            }
          }

          let idPacienteCitaNum = null;
          if (idPacienteCita !== null) {
            idPacienteCitaNum = typeof idPacienteCita === 'string' ? parseInt(idPacienteCita, 10) : idPacienteCita;
          }

          if (idPacienteCitaNum && idPacienteCitaNum > 0) {
            const estaAsignado = this.pacientesAsignadosIds.some(id => id === idPacienteCitaNum);
            if (estaAsignado) {
              return true;
            }
          }

          const correoPaciente = c.correopaciente || c.correoPaciente || c.CorreoPaciente ||
            c.emailPaciente || c.email || c.correo || c.Correo;
          if (correoPaciente && correoPaciente.length > 0) {
            const estaAsignado = this.pacientesAsignadosEmails.some(
              email => email && email.toLowerCase() === correoPaciente.toLowerCase()
            );
            if (estaAsignado) {
              return true;
            }
          }

          return false;
        })
        : [];

      const totalVisitas = citasFiltradas.length;
      const visitasCompletadas = citasFiltradas.filter((c: any) => {
        const estado = (c.estado || '').toLowerCase();
        return ['completada', 'realizada', 'finalizada'].includes(estado);
      }).length;
      const visitasPendientes = citasFiltradas.filter((c: any) => {
        const estado = (c.estado || '').toLowerCase();
        return ['programada', 'pendiente', 'confirmada', 'agendada'].includes(estado);
      }).length;
      const visitasCanceladas = citasFiltradas.filter((c: any) => {
        const estado = (c.estado || '').toLowerCase();
        return ['cancelada'].includes(estado);
      }).length;

      let ultimaVisita: string | null = null;
      let proximaVisita: string | null = null;

      if (citasFiltradas.length > 0) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const citasOrdenadas = [...citasFiltradas].sort((a, b) => {
          return new Date(b.fechacita || b.fecha || b.fechaCita).getTime() -
            new Date(a.fechacita || a.fecha || a.fechaCita).getTime();
        });

        if (citasOrdenadas.length > 0) {
          ultimaVisita = citasOrdenadas[0].fechacita || citasOrdenadas[0].fecha || citasOrdenadas[0].fechaCita;
        }

        const citasFuturas = citasFiltradas.filter((c: any) => {
          const fechaVisita = new Date(c.fechacita || c.fecha || c.fechaCita);
          const estado = (c.estado || '').toLowerCase();
          return fechaVisita >= hoy && ['programada', 'pendiente', 'confirmada', 'agendada'].includes(estado);
        }).sort((a, b) => {
          return new Date(a.fechacita || a.fecha || a.fechaCita).getTime() -
            new Date(b.fechacita || b.fecha || b.fechaCita).getTime();
        });

        if (citasFuturas.length > 0) {
          proximaVisita = citasFuturas[0].fechacita || citasFuturas[0].fecha || citasFuturas[0].fechaCita;
        }
      }

      this.estadisticas = {
        totalVisitas: totalVisitas,
        visitasCompletadas: visitasCompletadas,
        visitasPendientes: visitasPendientes,
        visitasCanceladas: visitasCanceladas,
        ultimaVisita: ultimaVisita,
        proximaVisita: proximaVisita
      };

      if (citasFiltradas.length > 0) {
        const pacientesUnicos = new Map();
        citasFiltradas.forEach((c: any) => {
          const nombre = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
          const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
          const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';
          const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'Paciente';
          const id = c.idpaciente || c.idPaciente || c.pacienteId || c.id;

          if (!pacientesUnicos.has(id) && id) {
            pacientesUnicos.set(id, {
              id: id,
              nombre: nombreCompleto,
              motivo: c.motivo || c.Motivo || 'Consulta',
              fechavisita: this.formatearFecha(c.fechacita || c.fecha || c.fechaCita || new Date().toISOString()),
              horavisita: c.horacita || c.hora || c.horaCita || '00:00',
              estado: c.estado || 'Programada'
            });
          }
        });
        this.visitasAcompanante = Array.from(pacientesUnicos.values()).slice(0, 10);
      } else {
        this.visitasAcompanante = [];
      }

      const historial: HistorialItem[] = [];

      citasFiltradas.forEach((c: any) => {
        const nombre = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
        const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
        const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';
        const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'Paciente';

        const fecha = c.fechacita || c.fecha || c.fechaCita || c.created_at || new Date().toISOString();
        const estado = (c.estado || 'Programada').toLowerCase();

        let accion = '';
        let detalle = '';

        switch (estado) {
          case 'completada':
          case 'realizada':
          case 'finalizada':
            accion = 'Cita completada';
            detalle = `Cita con ${nombreCompleto} finalizada`;
            break;
          case 'programada':
          case 'confirmada':
          case 'agendada':
            accion = 'Cita programada';
            detalle = `Nueva cita agendada para ${nombreCompleto}`;
            break;
          case 'cancelada':
            accion = 'Cita cancelada';
            detalle = `Cita de ${nombreCompleto} fue cancelada`;
            break;
          default:
            accion = `Cita ${estado}`;
            detalle = `Cita de ${nombreCompleto}`;
        }

        historial.push({
          fecha: this.formatearFecha(fecha),
          accion: accion,
          detalle: detalle,
          usuario: nombreCompleto,
          tipo: 'cita',
          id: c.idcita || c.id,
          estado: estado
        });
      });

      historial.sort((a, b) => {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      this.historialCambios = historial;

    } catch (error) {
      this.estadisticas = {
        totalVisitas: 0,
        visitasCompletadas: 0,
        visitasPendientes: 0,
        visitasCanceladas: 0,
        ultimaVisita: null,
        proximaVisita: null
      };
      this.visitasAcompanante = [];
      this.historialCambios = [];
    } finally {
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
      usuario: 'Usuario actual',
      tipo: 'doctor'
    });
  }

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

      if (payload.curp && payload.curp.length > 0) {
        const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
        if (!curpRegex.test(payload.curp)) {
          this.lanzarNotificacion("El formato de CURP no es válido. Debe tener 18 caracteres alfanuméricos.", "warning");
          this.isSaving = false;
          return;
        }
      }

      if (payload.codigoPostal && payload.codigoPostal.length > 0) {
        const cpRegex = /^[0-9]{5}$/;
        if (!cpRegex.test(payload.codigoPostal)) {
          this.lanzarNotificacion("El código postal debe tener 5 dígitos numéricos.", "warning");
          this.isSaving = false;
          return;
        }
      }

      await firstValueFrom(this.usersService.updateUsuario(id, payload));

      this.lanzarNotificacion("La información del acompañante ha sido actualizada.", "success");

      this.agregarHistorial('Datos actualizados', 'Información del acompañante actualizada');

      setTimeout(() => {
        this.router.navigate(['/admin/acompanantes']);
      }, 2000);

    } catch (error: any) {
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo guardar: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

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
}