import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleService } from '../../../../../../core/services/google.service';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

import { InfoMedicoComponent } from './partials/info-medico/info-medico';
import { HistorialMedicoComponent } from './partials/historial-medico/historial-medico';
import { ExpedienteMedicoComponent } from './partials/expediente-medico/expediente-medico';

type TabMedico = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-medico-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Menu,
    InfoMedicoComponent,
    HistorialMedicoComponent,
    ExpedienteMedicoComponent
  ],
  templateUrl: './medico-detalle.html',
  styleUrls: ['./medico-detalle.css']
})
export class MedicoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  usuarioSeleccionado: any = null;
  isSaving = false;

  activeTab: TabMedico = 'info';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  historialCambios: any[] = [];
  pacientesAtendidos: any[] = [];
  cargandoDatos: boolean = false;

  estadisticas: {
    totalPacientes: number;
    citasCompletadas: number;
    citasPendientes: number;
    promedioConsultas: number;
  } | null = null;

  medicoId: number | null = null;
  pacientesAsignadosIds: number[] = [];
  pacientesAsignadosEmails: string[] = [];

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const state = history.state;

    if (state && state.usuario) {
      this.medicoId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();
      this.cargarDatosReales();
    } else {
      this.router.navigate(['/admin/medicos']);
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  cambiarTab(tab: TabMedico) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    if (!this.usuarioSeleccionado.fechaNacimiento) {
      this.usuarioSeleccionado.fechaNacimiento = '';
    }
    if (!this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = '';
    }
    if (!this.usuarioSeleccionado.domicilio) {
      this.usuarioSeleccionado.domicilio = '';
    }
    if (!this.usuarioSeleccionado.codigoPostal) {
      this.usuarioSeleccionado.codigoPostal = '';
    }
    if (!this.usuarioSeleccionado.localidad) {
      this.usuarioSeleccionado.localidad = '';
    }
    if (!this.usuarioSeleccionado.municipio) {
      this.usuarioSeleccionado.municipio = '';
    }
    if (!this.usuarioSeleccionado.estado) {
      this.usuarioSeleccionado.estado = '';
    }
    if (!this.usuarioSeleccionado.direccionClinica) {
      this.usuarioSeleccionado.direccionClinica = '';
    }

    if (!this.usuarioSeleccionado.tempNombre) {
      this.usuarioSeleccionado.tempNombre = this.usuarioSeleccionado.nombre || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoPaterno) {
      this.usuarioSeleccionado.tempApellidoPaterno = this.usuarioSeleccionado.apPaterno || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoMaterno) {
      this.usuarioSeleccionado.tempApellidoMaterno = this.usuarioSeleccionado.apMaterno || '';
    }

    this.cdr.detectChanges();
  }

  private async cargarPacientesAsignados() {
    if (!this.medicoId) {
      return;
    }

    try {
      let pacientesData: any[] = [];
      let response: any = null;

      try {
        response = await firstValueFrom(
          this.usersService.getPacientesDeDoctor(this.medicoId)
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

      if (!pacientesData || pacientesData.length === 0) {
        try {
          const allPacientesResponse = await firstValueFrom(
            this.usersService.getTodosLosPacientes()
          );

          let allPacientes: any[] = [];

          if (allPacientesResponse) {
            if (allPacientesResponse.data !== undefined) {
              allPacientes = allPacientesResponse.data || [];
            } else if (Array.isArray(allPacientesResponse)) {
              allPacientes = allPacientesResponse;
            } else if (typeof allPacientesResponse === 'object') {
              for (const key in allPacientesResponse) {
                if (Array.isArray(allPacientesResponse[key])) {
                  allPacientes = allPacientesResponse[key];
                  break;
                }
              }
            }
          }

          const doctorIdNum = Number(this.medicoId);

          pacientesData = allPacientes.filter((p: any) => {
            const posiblesPropiedades = [
              'DoctorAsignado', 'doctorasignado', 'IdDoctorAsignado', 'iddoctorasignado',
              'IdDoctor', 'iddoctor', 'DoctorId', 'doctorId', 'doctor_id'
            ];

            let doctorIdEncontrado = null;

            for (const prop of posiblesPropiedades) {
              if (p[prop] !== undefined && p[prop] !== null) {
                doctorIdEncontrado = p[prop];
                break;
              }
            }

            const asignado = p.AsignacionActiva === true || p.asignacionactiva === true;

            if (doctorIdEncontrado !== null && doctorIdEncontrado !== undefined) {
              const idNum = Number(doctorIdEncontrado);
              return idNum === doctorIdNum && asignado;
            }
            return false;
          });

        } catch (err) {
          // Error silencioso
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

  private async cargarDatosReales() {
    if (!this.medicoId) return;

    this.cargandoDatos = true;
    try {
      await this.cargarPacientesAsignados();

      const [citas, tratamientos, usuarios] = await Promise.all([
        firstValueFrom(this.usersService.getAllCitas()).catch(() => []),
        firstValueFrom(this.usersService.getTratamientos()).catch(() => []),
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

      const tratamientosFiltrados = Array.isArray(tratamientos)
        ? tratamientos.filter((t: any) => {
          const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId || t.id_usuario;
          const pacienteIdNum = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;
          return pacienteIdNum > 0 && this.pacientesAsignadosIds.some(id => id === pacienteIdNum);
        })
        : [];

      const totalPacientes = this.pacientesAsignadosIds.length;

      const citasCompletadas = citasFiltradas.filter((c: any) => {
        const estado = (c.estado || '').toLowerCase();
        return ['completada', 'realizada', 'finalizada'].includes(estado);
      }).length;

      const citasPendientes = citasFiltradas.filter((c: any) => {
        const estado = (c.estado || '').toLowerCase();
        return ['programada', 'pendiente', 'confirmada', 'agendada'].includes(estado);
      }).length;

      let promedioConsultas = 0;
      if (citasFiltradas.length > 0) {
        const meses = new Set();
        citasFiltradas.forEach((c: any) => {
          const fecha = c.fechacita || c.fecha || c.fechaCita;
          if (fecha) {
            try {
              const d = new Date(fecha);
              if (!isNaN(d.getTime())) {
                meses.add(`${d.getFullYear()}-${d.getMonth()}`);
              }
            } catch (e) { }
          }
        });
        const mesesCount = meses.size || 1;
        promedioConsultas = Math.round((citasFiltradas.length / mesesCount) * 10) / 10;
      }

      this.estadisticas = {
        totalPacientes: totalPacientes,
        citasCompletadas: citasCompletadas,
        citasPendientes: citasPendientes,
        promedioConsultas: promedioConsultas
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
              fechaUltimaCita: this.formatearFecha(c.fechacita || c.fecha || c.fechaCita || new Date().toISOString())
            });
          }
        });
        this.pacientesAtendidos = Array.from(pacientesUnicos.values()).slice(0, 10);
      } else {
        this.pacientesAtendidos = [];
      }

      const historial: any[] = [];

      if (citasFiltradas.length > 0) {
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
              detalle = `Consulta con ${nombreCompleto} finalizada`;
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
            case 'pendiente':
              accion = 'Cita pendiente';
              detalle = `Cita de ${nombreCompleto} está pendiente`;
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
      }

      if (tratamientosFiltrados.length > 0) {
        tratamientosFiltrados.forEach((t: any) => {
          const nombreMedicamento = t.nombremedicamento || t.NombreMedicamento || 'Medicamento';

          let nombrePaciente = 'Paciente';
          const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente;
          if (pacienteId && Array.isArray(usuarios)) {
            const paciente = usuarios.find((u: any) => (u.idusuario || u.id) === pacienteId);
            if (paciente) {
              const nombre = paciente.nombre || '';
              const apPaterno = paciente.apPaterno || '';
              const apMaterno = paciente.apMaterno || '';
              nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'Paciente';
            }
          }

          const fecha = t.created_at || t.fechainicio || t.FechaInicio || new Date().toISOString();
          const activo = t.activo !== false && t.activo !== 0;

          historial.push({
            fecha: this.formatearFecha(fecha),
            accion: activo ? 'Tratamiento iniciado' : 'Tratamiento finalizado',
            detalle: `${activo ? 'Inicio' : 'Fin'} de tratamiento con ${nombreMedicamento} para ${nombrePaciente}`,
            usuario: nombrePaciente,
            tipo: 'tratamiento',
            id: t.idtratamiento || t.id
          });
        });
      }

      historial.sort((a, b) => {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      this.historialCambios = historial;

    } catch (error) {
      this.estadisticas = {
        totalPacientes: 0,
        citasCompletadas: 0,
        citasPendientes: 0,
        promedioConsultas: 0
      };
      this.pacientesAtendidos = [];
      this.historialCambios = [];
    } finally {
      this.cargandoDatos = false;
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

  getEstadoMedico(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.citasPendientes > 0) {
      return { texto: 'Con citas pendientes', clase: 'estado-ocupado', icono: 'bi-clock-fill' };
    }

    return { texto: 'Activo disponible', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.tempNombre || u.tempNombre.trim().length < 2) {
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

    return { valido: true, mensaje: '' };
  }

  volver() {
    this.location.back();
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

  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.tempNombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();
    const correoFinal = this.usuarioSeleccionado.correo || this.usuarioSeleccionado.Correo;

    if (!nombre || !apPaterno || !correoFinal) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo electronico son requeridos.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
      return;
    }

    const nombreAnterior = this.usuarioSeleccionado.nombre || '';
    const apPaternoAnterior = this.usuarioSeleccionado.apPaterno || '';

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const idFinal = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

      const datosActualizados = {
        nombre: nombre,
        apPaterno: apPaterno,
        appaterno: apPaterno,
        apMaterno: apMaterno,
        apmaterno: apMaterno,
        correo: correoFinal,
        telefono: this.usuarioSeleccionado.telefono || 'Sin telefono',
        genero: this.usuarioSeleccionado.genero || 'No especificado',
        especialidad: this.usuarioSeleccionado.especialidad || 'General',
        direccionClinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        direccionclinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        rol: this.usuarioSeleccionado.rol || 'Medico',
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento || null,
        curp: (this.usuarioSeleccionado.curp || '').toUpperCase().trim(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      if (this.usuarioSeleccionado.fuente === 'Firebase') {
        await this.googleService.updateUsuario(idFinal, datosActualizados);
      } else {
        await firstValueFrom(this.usersService.updateUsuario(idFinal, datosActualizados));
      }

      if (nombreAnterior !== nombre || apPaternoAnterior !== apPaterno) {
        this.agregarHistorial(
          'Datos personales actualizados',
          `De: "${nombreAnterior} ${apPaternoAnterior}" a "${nombre} ${apPaterno}"`
        );
      } else {
        this.agregarHistorial(
          'Informacion actualizada',
          'Datos del medico actualizados'
        );
      }

      this.lanzarNotificacion("Los datos del medico se actualizaron correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/admin/medicos']);
      }, 2000);

    } catch (error) {
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  onCambioDatos() {
    this.cdr.detectChanges();
  }
}