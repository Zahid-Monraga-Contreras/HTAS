import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// ==========================================================================
// INTERFACES
// ==========================================================================

interface HistorialDispositivo {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

interface MedicionTensiometro {
  id: number;
  sistolica: number;
  diastolica: number;
  pulso: number;
  fecha: string;
  guardada: boolean;
}

type TabDispositivo = 'detalle' | 'historial' | 'mediciones';

@Component({
  selector: 'app-dispositivo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
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

  // ==========================================================================
  // PROPIEDADES DEL DISPOSITIVO
  // ==========================================================================

  dispositivoSeleccionado: any = null;
  isSaving = false;
  pacientesLista: any[] = [];
  filtroPaciente: string = '';
  mostrarDropdown = false;
  modo: string = 'editar'; // 'editar' | 'medir'
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

  ultimaMedicion: any = null;
  historialCambios: HistorialDispositivo[] = [];
  mostrarHistorial = false;

  // ==========================================================================
  // ESTADO DE CONEXIÓN
  // ==========================================================================

  estadoConexion: 'conectado' | 'desconectado' | 'sincronizando' = 'desconectado';
  ultimaSincronizacion: string | null = null;

  // ==========================================================================
  // ESTADÍSTICAS
  // ==========================================================================

  estadisticas: {
    totalMediciones: number;
    promedioSistolica: number;
    promedioDiastolica: number;
    promedioPulso: number;
  } | null = null;

  // ==========================================================================
  // PROPIEDADES DEL TENSIÓMETRO
  // ==========================================================================

  isObteniendoMedicion = false;
  ultimaMedicionTensiometro: {
    sistolica: number;
    diastolica: number;
    pulso: number;
    fecha: string;
  } | null = null;

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
    // Cargar usuario actual
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_htas');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        const rol = this.currentUser?.rol?.toLowerCase().trim() || '';
        this.esPacienteOAcompanante = rol === 'paciente' || rol === 'acompañante';

        // Si es paciente o acompañante, forzar la pestaña de mediciones
        if (this.esPacienteOAcompanante) {
          this.activeTab = 'mediciones';
        }
      }
    }

    await this.cargarDispositivo();
    await this.cargarPacientes();
    await this.cargarDatosIniciales();
    this.inicializarTensiometro();
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
  // CONTROL DE PESTAÑAS
  // ==========================================================================

  cambiarTab(tab: TabDispositivo) {
    // Si es paciente o acompañante, solo puede ver la pestaña de mediciones
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
  // MÉTODOS DE CARGA INICIAL
  // ==========================================================================

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

      // Si es paciente o acompañante, forzar modo medición
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
            this.router.navigate(['/dispositivos']);
          }
        } catch (error) {
          console.error("Error al cargar dispositivo:", error);
          this.router.navigate(['/dispositivos']);
        }
      } else {
        this.router.navigate(['/dispositivos']);
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

  inicializarTensiometro() {
    // Ya se carga en cargarDatosIniciales
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

  onFiltroPacienteChange() {
    if (this.filtroPaciente.length > 0) {
      this.mostrarDropdown = true;
    }
  }

  private normalizarMedicion(data: any): any | null {
    if (!data) return null;

    return {
      idmedicion: data.idmedicion || data.IdMedicion,
      sistolica: data.sistolica || data.Sistolica || 0,
      diastolica: data.diastolica || data.Diastolica || 0,
      pulso: data.pulso || data.Pulso || 0,
      fechahoralectura: data.fechahoralectura || data.FechaHoraLectura || data.created_at || data.createdat
    };
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

      if (data?.mediciones?.length > 0) {
        const mediciones = data.mediciones.map((m: any, index: number) => ({
          id: index + 1,
          sistolica: m.sistolica || m.Sistolica || 0,
          diastolica: m.diastolica || m.Diastolica || 0,
          pulso: m.pulso || m.Pulso || 0,
          fecha: m.fechahoralectura || m.FechaHoraLectura || new Date().toISOString(),
          guardada: true
        }));

        this.medicionesTensiometro = mediciones;

        if (mediciones.length > 0) {
          this.ultimaMedicionTensiometro = {
            sistolica: mediciones[0].sistolica,
            diastolica: mediciones[0].diastolica,
            pulso: mediciones[0].pulso,
            fecha: mediciones[0].fecha
          };
        }
        setTimeout(() => this.cdr.detectChanges());
      }
    } catch (error) {
      console.warn('No se pudieron cargar mediciones previas:', error);
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
  // MÉTODO PRINCIPAL: OBTENER MEDICIÓN DEL TENSIÓMETRO
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

  // ==========================================================================
  // MÉTODOS AUXILIARES PARA PROCESAR MEDICIÓN
  // ==========================================================================

  private async procesarMedicionExitosa(medicion: any) {
    const sistolica = medicion.sistolica || 0;
    const diastolica = medicion.diastolica || 0;
    const pulso = medicion.pulso || 0;

    this.ultimaMedicionTensiometro = {
      sistolica: sistolica,
      diastolica: diastolica,
      pulso: pulso,
      fecha: new Date().toISOString()
    };

    this.medicionesTensiometro.unshift({
      id: Date.now(),
      sistolica: sistolica,
      diastolica: diastolica,
      pulso: pulso,
      fecha: new Date().toISOString(),
      guardada: true
    });

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
  // MÉTODOS DE GESTIÓN DE PACIENTES (SOLO PARA ADMIN/MÉDICO)
  // ==========================================================================

  get pacientesFiltrados() {
    if (!this.filtroPaciente) return this.pacientesLista;
    const term = this.filtroPaciente.toLowerCase();
    return this.pacientesLista.filter(p => {
      const nombreCompleto = this.obtenerNombreCompleto(p).toLowerCase();
      return nombreCompleto.includes(term);
    });
  }

  ocultarDropdown() {
    setTimeout(() => {
      this.mostrarDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  asignarPaciente(p: any) {
    // Si es paciente o acompañante, no puede asignar pacientes
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

    this.filtroPaciente = this.obtenerNombreCompleto(p);
    this.mostrarDropdown = false;

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
    // Si es paciente o acompañante, no puede desasignar pacientes
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
      this.filtroPaciente = '';

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

  getEstadoConexionClass(): string {
    const clases = {
      'conectado': 'estado-conectado',
      'desconectado': 'estado-desconectado',
      'sincronizando': 'estado-sincronizando'
    };
    return clases[this.estadoConexion] || 'estado-desconectado';
  }

  getEstadoConexionTexto(): string {
    const textos = {
      'conectado': 'Conectado',
      'desconectado': 'Desconectado',
      'sincronizando': 'Sincronizando...'
    };
    return textos[this.estadoConexion] || 'Desconectado';
  }

  getEstadoConexionIcono(): string {
    const iconos = {
      'conectado': 'bi-wifi',
      'desconectado': 'bi-wifi-off',
      'sincronizando': 'bi-arrow-repeat'
    };
    return iconos[this.estadoConexion] || 'bi-wifi-off';
  }

  getEstadoBotonMedicion(): string {
    if (this.isObteniendoMedicion) return 'bi-arrow-repeat spin';
    return 'bi-heart-pulse';
  }

  getEstadoBotonTexto(): string {
    if (this.isObteniendoMedicion) return 'Obteniendo medición...';
    return 'Obtener Medición';
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
    // Si es paciente o acompañante, no puede cambiar el estado
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
    // Si es paciente o acompañante, no puede guardar cambios
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
        this.router.navigate(['/dispositivos']);
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
  // MÉTODOS DE UBICACIÓN
  // ==========================================================================

  getUbicacionPaciente(): string {
    const p = this.dispositivoSeleccionado?.paciente;
    if (!p) return 'Sin ubicación registrada';
    const partes = [p.domicilio, p.localidad, p.municipio, p.estado].filter(Boolean);
    return partes.length ? partes.join(', ') : 'Sin ubicación completa';
  }

  pacienteTieneUbicacion(): boolean {
    const p = this.dispositivoSeleccionado?.paciente;
    if (!p) return false;
    return !!(p.domicilio && p.localidad && p.municipio && p.estado);
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
  // MÉTODOS PARA EL TEMPLATE - CONTROL DE VISIBILIDAD
  // ==========================================================================

  /**
   * Verifica si el usuario puede editar el dispositivo
   */
  puedeEditar(): boolean {
    return !this.esPacienteOAcompanante;
  }

  /**
   * Verifica si el usuario puede ver la pestaña de detalle
   */
  puedeVerDetalle(): boolean {
    return !this.esPacienteOAcompanante;
  }

  /**
   * Verifica si el usuario puede ver la pestaña de historial
   */
  puedeVerHistorial(): boolean {
    return !this.esPacienteOAcompanante;
  }

  /**
   * Verifica si el usuario puede ver la pestaña de mediciones
   */
  puedeVerMediciones(): boolean {
    return true; // Todos pueden ver mediciones
  }

  /**
   * Verifica si el usuario puede tomar mediciones
   */
  puedeMedir(): boolean {
    return true; // Todos pueden medir (paciente, acompañante, admin, médico)
  }
}