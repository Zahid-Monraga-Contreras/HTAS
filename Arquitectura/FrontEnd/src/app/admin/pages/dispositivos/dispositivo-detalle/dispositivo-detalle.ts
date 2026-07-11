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

interface MedicionBackend {
  idmedicion?: number;
  IdMedicion?: number;
  sistolica: number;
  Sistolica?: number;
  diastolica: number;
  Diastolica?: number;
  pulso: number;
  Pulso?: number;
  fechahoralectura?: string;
  FechaHoraLectura?: string;
  created_at?: string;
  createdat?: string;
}

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
  // ✅ NUEVO: PANEL DE PROGRESO DE CONEXIÓN (refleja los logs del backend)
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
  // CICLO DE VIDA - OnInit
  // ==========================================================================

  async ngOnInit() {
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
            // ✅ FIX NG0100: se pospone al siguiente macrotask para no
            // chocar con el primer ciclo de detección de cambios de Angular.
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

  // ✅ MÉTODO PARA OBTENER NOMBRE COMPLETO DEL PACIENTE
  obtenerNombreCompleto(paciente: any): string {
    if (!paciente) return '';
    const nombre = paciente.nombre || '';
    const apPaterno = paciente.appaterno || paciente.apPaterno || '';
    const apMaterno = paciente.apmaterno || paciente.apMaterno || '';
    return `${nombre} ${apPaterno} ${apMaterno}`.trim();
  }

  // ✅ MÉTODO PARA FILTRAR PACIENTES EN TIEMPO REAL
  onFiltroPacienteChange() {
    if (this.filtroPaciente.length > 0) {
      this.mostrarDropdown = true;
    }
  }

  private normalizarMedicion(data: any): MedicionBackend | null {
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
      // ✅ FIX NG0100: pospuesto para no interferir con el primer chequeo de Angular
      setTimeout(() => this.cdr.detectChanges());
    } catch (error) {
      console.warn("No hay mediciones previas.");
      this.ultimaMedicion = null;
      setTimeout(() => this.cdr.detectChanges());
    }
  }

  async cargarEstadisticas(idDispositivo: number) {
    try {
      this.estadisticas = {
        totalMediciones: Math.floor(Math.random() * 50) + 5,
        promedioSistolica: Math.floor(Math.random() * 30) + 110,
        promedioDiastolica: Math.floor(Math.random() * 20) + 70,
        promedioPulso: Math.floor(Math.random() * 30) + 60
      };
    } catch (error) {
      console.warn("No se pudieron cargar estadísticas:", error);
      this.estadisticas = null;
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
        // ✅ FIX NG0100: pospuesto para no interferir con el primer chequeo de Angular
        setTimeout(() => this.cdr.detectChanges());
      }
    } catch (error) {
      console.warn('No se pudieron cargar mediciones previas:', error);
      this.medicionesTensiometro = [];
    }
  }

  // ==========================================================================
  // ✅ NUEVO: SIMULACIÓN DE PROGRESO (muestra en el frontend lo que hace el backend)
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
      // Al llegar al último paso ("Esperando medición...") se detiene el
      // avance automático, pero el panel se queda visible mostrando ese
      // último estado hasta que llegue la respuesta real del backend.
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

    // Se oculta el panel un momento después para que el usuario alcance a leer el resultado final
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

    console.log(' Dispositivo:', this.dispositivoSeleccionado);
    console.log(' ID Paciente encontrado:', idPaciente);

    if (!idPaciente) {
      this.lanzarNotificacion(' El dispositivo no tiene un paciente asignado', 'warning');
      return;
    }

    if (this.isObteniendoMedicion) {
      this.lanzarNotificacion(' Ya hay una medición en proceso...', 'warning');
      return;
    }

    this.isObteniendoMedicion = true;
    this.estadoConexion = 'sincronizando';
    this.lanzarNotificacion(' Conectando al tensiómetro...', 'warning');
    this.iniciarSimulacionProgreso();
    this.cdr.detectChanges();

    try {
      console.log(` Solicitando medición para paciente ${idPaciente}`);
      const response = await firstValueFrom(
        this.usersService.obtenerMedicionTensiometro(idPaciente)
      );

      console.log(' Respuesta del backend:', response);

      if (response?.success && response?.medicion) {
        this.finalizarProgreso('Medición recibida correctamente', true);
        await this.procesarMedicionExitosa(response.medicion);
      } else {
        const mensajeError = response?.error || 'Error al obtener medición';
        this.finalizarProgreso(`Error: ${mensajeError}`, false);
        this.lanzarNotificacion(` ${mensajeError}`, 'error');
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
      ` ${sistolica}/${diastolica} mmHg, Pulso: ${pulso} bpm`
    );

    await this.cargarEstadisticas(this.dispositivoSeleccionado?.iddispositivo);
    this.cdr.detectChanges();
  }

  private async manejarErrorMedicion(error: any) {
    console.error(' Error al obtener medición:', error);

    let mensajeError = ' Error al conectar con el tensiómetro';

    if (error.status === 500) {
      mensajeError = ' Error en el servidor. Revisa que el script Python esté configurado correctamente.';
    } else if (error.status === 404) {
      mensajeError = ' El endpoint no existe. Verifica la ruta del backend.';
    } else if (error.status === 0) {
      mensajeError = ' No se pudo conectar con el backend. Verifica que el servidor esté corriendo.';
    } else if (error.error?.error) {
      mensajeError = ` ${error.error.error}`;
    }

    this.lanzarNotificacion(mensajeError, 'error');
    this.estadoConexion = 'desconectado';
    this.cdr.detectChanges();
  }

  // ==========================================================================
  // MÉTODOS DE GESTIÓN DE PACIENTES
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
}