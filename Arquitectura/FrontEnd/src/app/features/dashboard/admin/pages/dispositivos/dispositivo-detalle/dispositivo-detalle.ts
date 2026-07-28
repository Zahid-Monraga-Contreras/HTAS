import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// Importar los partials
import { InfoDispositivo } from './partials/info-dispositivo/info-dispositivo';
import { HistorialDispositivo, HistorialEvento, Estadisticas } from './partials/historial-dispositivo/historial-dispositivo';
import { Mediciones, MedicionTensiometro, UltimaMedicion } from './partials/mediciones/mediciones';

// ==========================================================================
// INTERFACES
// ==========================================================================

type TabDispositivo = 'detalle' | 'historial' | 'mediciones';

@Component({
  selector: 'app-dispositivo-detalle',
  standalone: true,
  imports: [CommonModule, Menu, InfoDispositivo, HistorialDispositivo, Mediciones],
  templateUrl: './dispositivo-detalle.html',
  styleUrls: ['./dispositivo-detalle.css']
})
export class DispositivoDetalle implements OnInit, OnDestroy {
  // ==========================================================================
  // INYECCIONES
  // ==========================================================================

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('sidebar') sidebar!: Menu;

  // ==========================================================================
  // PROPIEDADES DEL DISPOSITIVO
  // ==========================================================================

  dispositivoSeleccionado: any = null;
  isSaving = false;
  pacientesLista: any[] = [];
  modo: string = 'editar';
  currentUser: any = null;
  esPacienteOAcompanante: boolean = false;

  // ==========================================================================
  // SISTEMA DE NOTIFICACIONES
  // ==========================================================================

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // ==========================================================================
  // DATOS DE MEDICIONES
  // ==========================================================================

  ultimaMedicion: UltimaMedicion | null = null;
  historialCambios: HistorialEvento[] = [];
  mostrarHistorial = false;

  // ==========================================================================
  // ESTADO DE CONEXIÓN
  // ==========================================================================

  estadoConexion: 'conectado' | 'desconectado' | 'sincronizando' = 'desconectado';
  ultimaSincronizacion: string | null = null;

  // ==========================================================================
  // ESTADÍSTICAS
  // ==========================================================================

  estadisticas: Estadisticas | null = null;

  // ==========================================================================
  // PROPIEDADES DEL TENSIÓMETRO
  // ==========================================================================

  isObteniendoMedicion = false;
  ultimaMedicionTensiometro: { sistolica: number; diastolica: number; pulso: number; fecha: string } | null = null;
  medicionesTensiometro: MedicionTensiometro[] = [];

  // ==========================================================================
  // PANEL DE PROGRESO DE CONEXIÓN
  // ==========================================================================

  progresoLog: string[] = [];
  progresoLogVisible = false;
  private progresoInterval: any = null;
  private ocultarProgresoTimeout: any = null;

  private readonly PASOS_CONEXION: string[] = [
    'Escaneando dispositivos Bluetooth...',
    'Asegúrate de que el tensiómetro esté ENCENDIDO',
    'Buscando dispositivos compatibles...',
    'Dispositivo BleModuleB encontrado',
    'Conectando al dispositivo...',
    'Conectado correctamente',
    'Buscando característica de medición...',
    'Esperando medición del tensiómetro...',
    'Presiona START en el tensiómetro si es necesario'
  ];

  // ==========================================================================
  // PESTAÑA ACTIVA
  // ==========================================================================

  activeTab: TabDispositivo = 'detalle';

  // ==========================================================================
  // CICLO DE VIDA - OnInit
  // ==========================================================================

  async ngOnInit() {
    await this.cargarUsuarioActual();
    await this.cargarDispositivo();
    await this.cargarPacientes();
    await this.cargarDatosIniciales();
  }

  // ==========================================================================
  // CICLO DE VIDA - OnDestroy
  // ==========================================================================

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.detenerSimulacionProgreso();
    if (this.ocultarProgresoTimeout) {
      clearTimeout(this.ocultarProgresoTimeout);
    }
  }

  // ==========================================================================
  // MÉTODOS DE CARGA
  // ==========================================================================

  private async cargarUsuarioActual() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_htas');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        const rol = this.currentUser?.rol?.toLowerCase().trim() || '';
        this.esPacienteOAcompanante = rol === 'paciente' || rol === 'acompañante';

        if (this.esPacienteOAcompanante) {
          this.activeTab = 'mediciones';
        }
      }
    }
  }

  private async cargarDispositivo() {
    let state: any = null;

    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    if (state && state.dispositivo) {
      this.dispositivoSeleccionado = { ...state.dispositivo };
      this.modo = state.modo || 'editar';

      if (this.esPacienteOAcompanante) {
        this.modo = 'medir';
      }

      this.inicializarCampos();
    } else {
      const idUrl = this.route.snapshot.paramMap.get('id');
      if (idUrl) {
        try {
          const todos = await firstValueFrom(this.usersService.getDispositivos());
          const encontrado = todos?.find((d: any) =>
            String(d.iddispositivo) === String(idUrl)
          );
          if (encontrado) {
            this.dispositivoSeleccionado = { ...encontrado };
            this.inicializarCampos();
            setTimeout(() => this.cdr.detectChanges());
          } else {
            this.router.navigate(['/admin/dispositivos']);
          }
        } catch (error) {
          console.error("Error al cargar dispositivo:", error);
          this.router.navigate(['/admin/dispositivos']);
        }
      } else {
        this.router.navigate(['/admin/dispositivos']);
      }
    }
  }

  private async cargarPacientes() {
    try {
      const todosLosPacientes = await firstValueFrom(this.usersService.getUsuariosBackend());
      this.pacientesLista = todosLosPacientes.filter((u: any) =>
        u.rol?.toLowerCase() === 'paciente' || u.rol?.toLowerCase() === 'pacientes'
      );
    } catch (error) {
      console.error("Error al cargar pacientes:", error);
      this.pacientesLista = [];
    }
  }

  private async cargarDatosIniciales() {
    const idPaciente = this.obtenerIdPaciente();

    if (idPaciente) {
      await Promise.all([
        this.cargarUltimaMedicion(idPaciente),
        this.cargarEstadisticas(this.dispositivoSeleccionado?.iddispositivo),
        this.cargarMedicionesTensiometro(idPaciente)
      ]);
    }

    this.cargarHistorialDispositivo();
    this.verificarUltimaSincronizacion();
  }

  // ==========================================================================
  // MÉTODOS DE INICIALIZACIÓN
  // ==========================================================================

  inicializarCampos() {
    if (!this.dispositivoSeleccionado) return;

    if (this.dispositivoSeleccionado.activo === undefined) {
      this.dispositivoSeleccionado.activo = true;
    }

    if (!this.dispositivoSeleccionado.idpaciente && this.dispositivoSeleccionado.idPacienteAsociado) {
      this.dispositivoSeleccionado.idpaciente = this.dispositivoSeleccionado.idPacienteAsociado;
    }

    if (this.dispositivoSeleccionado.paciente) {
      const p = this.dispositivoSeleccionado.paciente;
      if (!p.domicilio) p.domicilio = '';
      if (!p.localidad) p.localidad = '';
      if (!p.municipio) p.municipio = '';
      if (!p.estado) p.estado = '';
      if (!p.codigoPostal) p.codigoPostal = '';
    }
  }

  // ==========================================================================
  // MÉTODOS PARA OBTENER DATOS
  // ==========================================================================

  private obtenerIdPaciente(): number | null {
    return this.dispositivoSeleccionado?.idpaciente ||
      this.dispositivoSeleccionado?.idPacienteAsociado ||
      this.dispositivoSeleccionado?.idpacienteasociado ||
      null;
  }

  obtenerNombreCompleto(paciente: any): string {
    if (!paciente) return '';
    const nombre = paciente.nombre || '';
    const apPaterno = paciente.appaterno || paciente.apPaterno || '';
    const apMaterno = paciente.apmaterno || paciente.apMaterno || '';
    return `${nombre} ${apPaterno} ${apMaterno}`.trim();
  }

  private normalizarMedicion(data: any): UltimaMedicion | null {
    if (!data) return null;

    let fecha = data.fechahoralectura ||
      data.FechaHoraLectura ||
      data.fecha ||
      data.Fecha ||
      data.created_at ||
      data.createdat ||
      data.createdAt ||
      data.fechacreacion ||
      data.FechaCreacion ||
      new Date().toISOString();

    return {
      sistolica: Number(data.sistolica || data.Sistolica || 0),
      diastolica: Number(data.diastolica || data.Diastolica || 0),
      pulso: Number(data.pulso || data.Pulso || 0),
      fechahoralectura: fecha,
      fecha: fecha
    };
  }

  // ==========================================================================
  // MÉTODO DE DEBUG
  // ==========================================================================

  private debugEstructuraDatos(data: any) {
    if (data?.mediciones?.length > 0) {
      const primera = data.mediciones[0];
      console.log('ESTRUCTURA DE LA PRIMERA MEDICIÓN:');
      console.log('Campos:', Object.keys(primera));
      console.log('Contenido:', JSON.stringify(primera, null, 2));

      const camposFecha = Object.keys(primera).filter(key => {
        const value = primera[key];
        return typeof value === 'string' &&
          (value.includes('-') || value.includes('/')) &&
          value.length >= 8;
      });
      console.log('Posibles campos de fecha:', camposFecha);
    }
  }

  // ==========================================================================
  // CARGA DE MEDICIONES
  // ==========================================================================

  async cargarUltimaMedicion(idPaciente: number) {
    try {
      const data = await firstValueFrom(this.usersService.getUltimaMedicionPaciente(idPaciente));
      if (data && Object.keys(data).length > 0) {
        this.ultimaMedicion = this.normalizarMedicion(data);
      } else {
        this.ultimaMedicion = null;
      }
      setTimeout(() => this.cdr.detectChanges());
    } catch (error) {
      console.warn("No hay mediciones previas.");
      this.ultimaMedicion = null;
      setTimeout(() => this.cdr.detectChanges());
    }
  }

  async cargarEstadisticas(idDispositivo: number) {
    try {
      const idPaciente = this.obtenerIdPaciente();
      if (idPaciente) {
        const mediciones = await firstValueFrom(this.usersService.getMedicionesPaciente(idPaciente, 100));
        if (mediciones?.mediciones?.length > 0) {
          const lista = mediciones.mediciones;
          const total = lista.length;
          const sumSis = lista.reduce((acc: number, m: any) => acc + (m.sistolica || m.Sistolica || 0), 0);
          const sumDia = lista.reduce((acc: number, m: any) => acc + (m.diastolica || m.Diastolica || 0), 0);
          const sumPul = lista.reduce((acc: number, m: any) => acc + (m.pulso || m.Pulso || 0), 0);

          this.estadisticas = {
            totalMediciones: total,
            promedioSistolica: Math.round(sumSis / total),
            promedioDiastolica: Math.round(sumDia / total),
            promedioPulso: Math.round(sumPul / total)
          };
        } else {
          this.estadisticas = {
            totalMediciones: 0,
            promedioSistolica: 0,
            promedioDiastolica: 0,
            promedioPulso: 0
          };
        }
      } else {
        this.estadisticas = {
          totalMediciones: 0,
          promedioSistolica: 0,
          promedioDiastolica: 0,
          promedioPulso: 0
        };
      }
    } catch (error) {
      console.warn("No se pudieron cargar estadísticas:", error);
      this.estadisticas = {
        totalMediciones: 0,
        promedioSistolica: 0,
        promedioDiastolica: 0,
        promedioPulso: 0
      };
    }
  }

  async cargarMedicionesTensiometro(idPaciente: number) {
    try {
      const data = await firstValueFrom(this.usersService.getMedicionesPaciente(idPaciente, 10));

      console.log('Datos crudos de mediciones:', data);

      this.debugEstructuraDatos(data);

      if (data?.mediciones?.length > 0) {
        const mediciones = data.mediciones.map((m: any, index: number) => {
          let fecha = null;

          if (m.fechahoralectura) {
            fecha = m.fechahoralectura;
          } else if (m.FechaHoraLectura) {
            fecha = m.FechaHoraLectura;
          } else if (m.fecha) {
            fecha = m.fecha;
          } else if (m.Fecha) {
            fecha = m.Fecha;
          } else if (m.created_at) {
            fecha = m.created_at;
          } else if (m.createdat) {
            fecha = m.createdat;
          } else if (m.createdAt) {
            fecha = m.createdAt;
          } else if (m.fechacreacion) {
            fecha = m.fechacreacion;
          } else if (m.FechaCreacion) {
            fecha = m.FechaCreacion;
          }

          if (!fecha) {
            console.warn('Medición sin fecha en el índice', index, ':', m);
            for (const key of Object.keys(m)) {
              const value = m[key];
              if (typeof value === 'string' &&
                (value.includes('-') || value.includes('/')) &&
                value.length >= 8) {
                fecha = value;
                console.log('Fecha encontrada en campo:', key, '=', value);
                break;
              }
            }
            if (!fecha) {
              fecha = new Date().toISOString();
            }
          }

          let fechaISO = fecha;
          try {
            const dateObj = new Date(fecha);
            if (!isNaN(dateObj.getTime())) {
              fechaISO = dateObj.toISOString();
            } else {
              const partes = fecha.split('/');
              if (partes.length === 3) {
                const dia = parseInt(partes[0]);
                const mes = parseInt(partes[1]) - 1;
                const anio = parseInt(partes[2].split(' ')[0]);
                const horaPartes = partes[2].split(' ')[1]?.split(':') || [];
                const horas = parseInt(horaPartes[0]) || 0;
                const minutos = parseInt(horaPartes[1]) || 0;
                const segundos = parseInt(horaPartes[2]) || 0;

                const fechaObj = new Date(anio, mes, dia, horas, minutos, segundos);
                if (!isNaN(fechaObj.getTime())) {
                  fechaISO = fechaObj.toISOString();
                }
              }
            }
          } catch (error) {
            console.warn('Error al convertir fecha:', fecha);
            fechaISO = new Date().toISOString();
          }

          const sistolica = Number(m.sistolica || m.Sistolica || 0);
          const diastolica = Number(m.diastolica || m.Diastolica || 0);
          const pulso = Number(m.pulso || m.Pulso || 0);

          console.log(`Medición ${index + 1}:`, {
            fecha_original: fecha,
            fecha_iso: fechaISO,
            sistolica: sistolica,
            diastolica: diastolica,
            pulso: pulso
          });

          return {
            id: m.idmedicion || m.IdMedicion || m.id || index + 1,
            sistolica: sistolica,
            diastolica: diastolica,
            pulso: pulso,
            fecha: fechaISO,
            guardada: true
          };
        });

        // ============================================================
        // ORDENAR POR FECHA (más reciente PRIMERO)
        // ============================================================
        this.medicionesTensiometro = mediciones.sort((a: MedicionTensiometro, b: MedicionTensiometro) => {
          try {
            const dateA = new Date(a.fecha).getTime();
            const dateB = new Date(b.fecha).getTime();
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;
            return dateB - dateA;
          } catch (error) {
            return 0;
          }
        });

        console.log('Mediciones procesadas (ordenadas DESC):', this.medicionesTensiometro);

        if (this.medicionesTensiometro.length > 0) {
          const primera = this.medicionesTensiometro[0];
          this.ultimaMedicionTensiometro = {
            sistolica: primera.sistolica,
            diastolica: primera.diastolica,
            pulso: primera.pulso,
            fecha: primera.fecha
          };
        }

        // Forzar actualización de la vista
        this.cdr.detectChanges();

      } else {
        console.warn('No se encontraron mediciones');
        this.medicionesTensiometro = [];
      }
    } catch (error) {
      console.error('Error al cargar mediciones:', error);
      this.medicionesTensiometro = [];
    }
  }

  // ==========================================================================
  // SIMULACIÓN DE PROGRESO
  // ==========================================================================

  private iniciarSimulacionProgreso() {
    this.detenerSimulacionProgreso();
    if (this.ocultarProgresoTimeout) {
      clearTimeout(this.ocultarProgresoTimeout);
      this.ocultarProgresoTimeout = null;
    }

    this.progresoLog = [];
    this.progresoLogVisible = true;
    let index = 0;

    const mostrarSiguientePaso = () => {
      if (index < this.PASOS_CONEXION.length) {
        this.progresoLog.push(this.PASOS_CONEXION[index]);
        index++;
        this.cdr.detectChanges();
      }
      if (index >= this.PASOS_CONEXION.length) {
        this.detenerSimulacionProgreso();
      }
    };

    mostrarSiguientePaso();
    this.progresoInterval = setInterval(mostrarSiguientePaso, 1100);
  }

  private detenerSimulacionProgreso() {
    if (this.progresoInterval) {
      clearInterval(this.progresoInterval);
      this.progresoInterval = null;
    }
  }

  private finalizarProgreso(mensajeFinal: string, exito: boolean) {
    this.detenerSimulacionProgreso();
    this.progresoLog.push(mensajeFinal);
    this.cdr.detectChanges();

    this.ocultarProgresoTimeout = setTimeout(() => {
      this.progresoLogVisible = false;
      this.cdr.detectChanges();
    }, exito ? 2000 : 3000);
  }

  // ==========================================================================
  // MÉTODO PRINCIPAL: OBTENER MEDICIÓN
  // ==========================================================================

  async obtenerMedicionTensiometro() {
    const idPaciente = this.obtenerIdPaciente();

    if (!idPaciente) {
      this.lanzarNotificacion('El dispositivo no tiene un paciente asignado', 'warning');
      return;
    }

    if (this.isObteniendoMedicion) {
      this.lanzarNotificacion('Ya hay una medición en proceso...', 'warning');
      return;
    }

    this.isObteniendoMedicion = true;
    this.estadoConexion = 'sincronizando';
    this.lanzarNotificacion('Conectando al tensiómetro...', 'warning');
    this.iniciarSimulacionProgreso();
    this.cdr.detectChanges();

    try {
      const response = await firstValueFrom(
        this.usersService.obtenerMedicionTensiometro(idPaciente)
      );

      if (response?.success && response?.medicion) {
        this.finalizarProgreso('Medición recibida correctamente', true);
        await this.procesarMedicionExitosa(response.medicion);
      } else {
        const mensajeError = response?.error || 'Error al obtener medición';
        this.finalizarProgreso(`Error: ${mensajeError}`, false);
        this.lanzarNotificacion(`${mensajeError}`, 'error');
        this.estadoConexion = 'desconectado';
      }

    } catch (error: any) {
      this.finalizarProgreso('Error al conectar con el tensiómetro', false);
      await this.manejarErrorMedicion(error);
    } finally {
      this.isObteniendoMedicion = false;
      this.cdr.detectChanges();
    }
  }

  private async procesarMedicionExitosa(medicion: any) {
    const sistolica = medicion.sistolica || 0;
    const diastolica = medicion.diastolica || 0;
    const pulso = medicion.pulso || 0;

    const nuevaMedicion: MedicionTensiometro = {
      id: Date.now(),
      sistolica: sistolica,
      diastolica: diastolica,
      pulso: pulso,
      fecha: new Date().toISOString(),
      guardada: true
    };

    // AGREGAR AL INICIO DEL ARRAY
    this.medicionesTensiometro.unshift(nuevaMedicion);

    this.ultimaMedicionTensiometro = {
      sistolica: sistolica,
      diastolica: diastolica,
      pulso: pulso,
      fecha: new Date().toISOString()
    };

    this.ultimaMedicion = {
      sistolica: sistolica,
      diastolica: diastolica,
      pulso: pulso,
      fechahoralectura: new Date().toISOString()
    };

    this.estadoConexion = 'conectado';
    this.ultimaSincronizacion = new Date().toISOString();

    this.lanzarNotificacion(
      `${sistolica}/${diastolica} mmHg - Pulso: ${pulso} bpm`,
      'success'
    );

    this.agregarHistorial(
      'Medición obtenida',
      `${sistolica}/${diastolica} mmHg, Pulso: ${pulso} bpm`
    );

    await this.cargarEstadisticas(this.dispositivoSeleccionado?.iddispositivo);
    this.cdr.detectChanges();
  }

  private async manejarErrorMedicion(error: any) {
    console.error('Error al obtener medición:', error);

    let mensajeError = 'Error al conectar con el tensiómetro';

    if (error.status === 500) {
      mensajeError = 'Error en el servidor. Revisa que el script Python esté configurado correctamente.';
    } else if (error.status === 404) {
      mensajeError = 'El endpoint no existe. Verifica la ruta del backend.';
    } else if (error.status === 0) {
      mensajeError = 'No se pudo conectar con el backend. Verifica que el servidor esté corriendo.';
    } else if (error.error?.error) {
      mensajeError = `${error.error.error}`;
    }

    this.lanzarNotificacion(mensajeError, 'error');
    this.estadoConexion = 'desconectado';
    this.cdr.detectChanges();
  }

  // ==========================================================================
  // MÉTODOS DE GESTIÓN DE PACIENTES
  // ==========================================================================

  asignarPaciente(p: any) {
    if (this.esPacienteOAcompanante) {
      this.lanzarNotificacion('No tienes permiso para asignar pacientes.', 'warning');
      return;
    }

    this.dispositivoSeleccionado.idpaciente = p.idusuario;
    this.dispositivoSeleccionado.idPacienteAsociado = p.idusuario;
    this.dispositivoSeleccionado.nombrepaciente = p.nombre;
    this.dispositivoSeleccionado.appaternopaciente = p.appaterno || p.apPaterno || '';
    this.dispositivoSeleccionado.apmaternopaciente = p.apmaterno || p.apMaterno || '';
    this.dispositivoSeleccionado.paciente = {
      ...p,
      domicilio: p.domicilio || '',
      localidad: p.localidad || '',
      municipio: p.municipio || '',
      estado: p.estado || '',
      codigoPostal: p.codigoPostal || ''
    };

    const nombreCompleto = this.obtenerNombreCompleto(p);
    this.agregarHistorial(
      'Paciente asignado',
      `Asignado a: ${nombreCompleto}`
    );

    this.cargarUltimaMedicion(p.idusuario);
    this.cargarMedicionesTensiometro(p.idusuario);
    this.cdr.detectChanges();
  }

  desasignarPaciente() {
    if (this.esPacienteOAcompanante) {
      this.lanzarNotificacion('No tienes permiso para desasignar pacientes.', 'warning');
      return;
    }

    if (this.dispositivoSeleccionado.idpaciente) {
      const nombrePaciente = this.dispositivoSeleccionado.nombrepaciente || 'Paciente';
      this.dispositivoSeleccionado.idpaciente = null;
      this.dispositivoSeleccionado.idPacienteAsociado = null;
      this.dispositivoSeleccionado.nombrepaciente = null;
      this.dispositivoSeleccionado.appaternopaciente = null;
      this.dispositivoSeleccionado.apmaternopaciente = null;
      this.dispositivoSeleccionado.paciente = null;

      this.agregarHistorial(
        'Paciente desasignado',
        `Desasignado: ${nombrePaciente}`
      );

      this.ultimaMedicion = null;
      this.ultimaMedicionTensiometro = null;
      this.medicionesTensiometro = [];
      this.cdr.detectChanges();
    }
  }

  // ==========================================================================
  // MÉTODOS DE SINCRONIZACIÓN Y GUARDADO
  // ==========================================================================

  async sincronizarDispositivo() {
    if (!this.dispositivoSeleccionado) return;

    const id = this.dispositivoSeleccionado.iddispositivo;
    if (!id) {
      this.lanzarNotificacion("Error: No se encontró el ID del dispositivo.", "error");
      return;
    }

    this.estadoConexion = 'sincronizando';
    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      await firstValueFrom(this.usersService.sincronizarDispositivo(id));

      this.estadoConexion = 'conectado';
      this.ultimaSincronizacion = new Date().toISOString();
      this.agregarHistorial('Sincronización manual', 'Dispositivo sincronizado exitosamente');

      this.lanzarNotificacion("Dispositivo sincronizado correctamente.", "success");

      const idPaciente = this.obtenerIdPaciente();
      if (idPaciente) {
        await this.cargarUltimaMedicion(idPaciente);
        await this.cargarEstadisticas(id);
        await this.cargarMedicionesTensiometro(idPaciente);
      }
    } catch (error: any) {
      console.error("Error al sincronizar:", error);
      this.estadoConexion = 'desconectado';
      const msgErr = error.error?.error || error.message || "Error al sincronizar";
      this.lanzarNotificacion(`Error: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async toggleActivo() {
    if (this.esPacienteOAcompanante) {
      this.lanzarNotificacion('No tienes permiso para cambiar el estado del dispositivo.', 'warning');
      return;
    }

    if (!this.dispositivoSeleccionado) return;

    const id = this.dispositivoSeleccionado.iddispositivo;
    if (!id) {
      this.lanzarNotificacion("Error: No se encontró el ID del dispositivo.", "error");
      return;
    }

    const nuevoEstado = !this.dispositivoSeleccionado.activo;
    const mensaje = nuevoEstado ? 'activado' : 'desactivado';

    try {
      if (nuevoEstado) {
        await firstValueFrom(this.usersService.activarDispositivo(id));
      } else {
        await firstValueFrom(this.usersService.desactivarDispositivo(id));
      }

      this.dispositivoSeleccionado.activo = nuevoEstado;
      this.agregarHistorial(
        `Dispositivo ${mensaje}`,
        `El dispositivo fue ${mensaje}`
      );

      this.lanzarNotificacion(`Dispositivo ${mensaje} correctamente.`, "success");
    } catch (error: any) {
      console.error("Error al cambiar estado:", error);
      const msgErr = error.error?.error || error.message || "Error al cambiar estado";
      this.lanzarNotificacion(`Error: ${msgErr}`, "error");
    }
  }

  async guardarCambios() {
    if (this.esPacienteOAcompanante) {
      this.lanzarNotificacion('No tienes permiso para editar el dispositivo.', 'warning');
      return;
    }

    if (!this.dispositivoSeleccionado) return;

    const id = this.dispositivoSeleccionado.iddispositivo;
    if (!id) {
      this.lanzarNotificacion("Error interno: No se detectó el ID del dispositivo.", "error");
      return;
    }

    const nombreLimpio = (this.dispositivoSeleccionado.nombre || '').trim();
    if (!nombreLimpio) {
      this.lanzarNotificacion("El nombre del dispositivo es obligatorio.", "warning");
      return;
    }

    const mac = (this.dispositivoSeleccionado.direccionmac || '').trim().toUpperCase();
    if (mac) {
      const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/;
      if (!macRegex.test(mac)) {
        this.lanzarNotificacion("Formato de MAC address inválido. Ejemplo: AA:BB:CC:DD:EE:FF", "warning");
        return;
      }
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const estadoAnterior = this.dispositivoSeleccionado.activo;

      const payload = {
        nombre: nombreLimpio,
        direccionMac: mac,
        idPacienteAsociado: this.obtenerIdPaciente() || null,
        activo: !!this.dispositivoSeleccionado.activo
      };

      const respuesta = await firstValueFrom(this.usersService.actualizarDispositivo(id, payload));

      if (respuesta.dispositivo) {
        this.dispositivoSeleccionado = { ...this.dispositivoSeleccionado, ...respuesta.dispositivo };
      }

      if (estadoAnterior !== this.dispositivoSeleccionado.activo) {
        const nuevoEstado = this.dispositivoSeleccionado.activo ? 'activado' : 'desactivado';
        this.agregarHistorial(
          `Dispositivo ${nuevoEstado}`,
          `Estado cambiado a: ${nuevoEstado}`
        );
      }

      this.agregarHistorial(
        'Dispositivo actualizado',
        `Información del dispositivo actualizada`
      );

      this.lanzarNotificacion("¡Dispositivo actualizado con éxito!", "success");

      setTimeout(() => {
        this.router.navigate(['/admin/dispositivos']);
      }, 1500);

    } catch (error: any) {
      console.error("Error al actualizar:", error);
      const msgErr = error.error?.error || error.message || "Error al procesar la actualización.";
      this.lanzarNotificacion(`Error: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================================================
  // MÉTODOS DE HISTORIAL
  // ==========================================================================

  cargarHistorialDispositivo() {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);

    this.historialCambios = [
      {
        fecha: fechaStr,
        accion: 'Dispositivo registrado',
        detalle: 'Dispositivo vinculado al sistema',
        usuario: 'Sistema'
      }
    ];

    const idPaciente = this.obtenerIdPaciente();
    if (idPaciente) {
      const paciente = this.pacientesLista.find(p => p.idusuario === idPaciente);
      if (paciente) {
        this.historialCambios.push({
          fecha: fechaStr,
          accion: 'Paciente asignado',
          detalle: `Asignado a: ${this.obtenerNombreCompleto(paciente)}`,
          usuario: 'Sistema'
        });
      }
    }
  }

  agregarHistorial(accion: string, detalle: string) {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);
    this.historialCambios.unshift({
      fecha: fechaStr,
      accion: accion,
      detalle: detalle,
      usuario: 'Usuario actual'
    });
  }

  // ==========================================================================
  // MÉTODOS DE ESTADO DE CONEXIÓN
  // ==========================================================================

  verificarUltimaSincronizacion() {
    if (this.dispositivoSeleccionado?.ultimasincronizacion) {
      this.ultimaSincronizacion = this.dispositivoSeleccionado.ultimasincronizacion;
      if (this.ultimaSincronizacion) {
        const fecha = new Date(this.ultimaSincronizacion);
        const ahora = new Date();
        const diffHoras = (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60);

        if (diffHoras < 1) {
          this.estadoConexion = 'conectado';
        } else if (diffHoras < 24) {
          this.estadoConexion = 'sincronizando';
        } else {
          this.estadoConexion = 'desconectado';
        }
      }
    }
  }

  // ==========================================================================
  // CONTROL DE PESTAÑAS
  // ==========================================================================

  cambiarTab(tab: TabDispositivo) {
    if (this.esPacienteOAcompanante && tab !== 'mediciones') {
      this.lanzarNotificacion('No tienes permiso para acceder a esta sección.', 'warning');
      return;
    }

    if (this.activeTab === tab) return;
    this.activeTab = tab;

    if (tab === 'historial') {
      const idPaciente = this.obtenerIdPaciente();
      if (idPaciente) {
        this.cargarEstadisticas(this.dispositivoSeleccionado?.iddispositivo);
        this.cargarMedicionesTensiometro(idPaciente);
      }
    }

    if (tab === 'mediciones') {
      const idPaciente = this.obtenerIdPaciente();
      if (idPaciente) {
        this.cargarUltimaMedicion(idPaciente);
        this.cargarMedicionesTensiometro(idPaciente);
      }
    }

    this.cdr.detectChanges();
  }

  // ==========================================================================
  // SISTEMA DE NOTIFICACIONES
  // ==========================================================================

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

  // ==========================================================================
  // NAVEGACIÓN
  // ==========================================================================

  volver() {
    this.location.back();
  }

  // ==========================================================================
  // MÉTODOS PARA EL TEMPLATE
  // ==========================================================================

  puedeEditar(): boolean {
    return !this.esPacienteOAcompanante;
  }

  puedeVerDetalle(): boolean {
    return !this.esPacienteOAcompanante;
  }

  puedeVerHistorial(): boolean {
    return !this.esPacienteOAcompanante;
  }

  puedeVerMediciones(): boolean {
    return true;
  }

  puedeMedir(): boolean {
    return true;
  }
}