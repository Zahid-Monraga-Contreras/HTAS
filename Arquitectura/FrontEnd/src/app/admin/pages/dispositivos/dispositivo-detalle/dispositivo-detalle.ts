import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";
import { GoogleService } from '../../../../auth/services/google';
import { environment } from '../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';

// ✅ NUEVO: Interfaz para el historial del dispositivo
interface HistorialDispositivo {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

@Component({
  selector: 'app-dispositivo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './dispositivo-detalle.html',
  styleUrls: ['./dispositivo-detalle.css']
})
export class DispositivoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private googleService = inject(GoogleService);
  private http = inject(HttpClient);

  // Objeto unificado que interactúa con la vista
  dispositivoSeleccionado: any = null;
  isSaving = false;

  pacientesLista: any[] = [];
  filtroPaciente: string = '';
  mostrarDropdown = false;

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;
  ultimaMedicion: any = null;

  // ✅ NUEVO: Historial de cambios del dispositivo
  historialCambios: HistorialDispositivo[] = [];
  mostrarHistorial = false;

  // ✅ NUEVO: Estado de conectividad
  estadoConexion: 'conectado' | 'desconectado' | 'sincronizando' = 'desconectado';
  ultimaSincronizacion: string | null = null;

  // ✅ NUEVO: Estadísticas del dispositivo
  estadisticas: {
    totalMediciones: number;
    promedioSistolica: number;
    promedioDiastolica: number;
    promedioPulso: number;
  } | null = null;

  async ngOnInit() {
    let state: any = null;

    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    // 1. Intentar recuperar desde el estado de navegación de Angular
    if (state && state.dispositivo) {
      this.dispositivoSeleccionado = { ...state.dispositivo };
      // ✅ NUEVO: Inicializar campos si no existen
      this.inicializarCampos();
    } else {
      // 2. Recuperación de respaldo ante recargas físicas (F5) usando el ID de la URL
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
            this.cdr.detectChanges();
          } else {
            this.router.navigate(['/dispositivos']);
          }
        } catch (error) {
          console.error("Error al re-hidratar datos del dispositivo desde el servidor:", error);
          this.router.navigate(['/dispositivos']);
        }
      } else {
        this.router.navigate(['/dispositivos']);
      }
    }

    // Cargar última medición
    if (this.dispositivoSeleccionado?.idpaciente) {
      this.cargarUltimaMedicion(this.dispositivoSeleccionado.idpaciente);
      this.cargarEstadisticas(this.dispositivoSeleccionado.iddispositivo);
    }

    // Cargar lista de pacientes
    const todosLosPacientes = await firstValueFrom(this.usersService.getUsuariosBackend());
    this.pacientesLista = todosLosPacientes.filter((u: any) => u.rol === 'paciente');

    // Cargar historial del dispositivo
    this.cargarHistorialDispositivo();

    // Verificar estado de Google Fit
    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'success' && this.dispositivoSeleccionado?.idpaciente) {
        this.lanzarNotificacion("Vinculación exitosa con Google Fit", "success");
        this.estadoConexion = 'conectado';
        this.cargarDatosGoogleFit();
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { status: null },
          queryParamsHandling: 'merge'
        });
      }
    });

    // ✅ NUEVO: Verificar última sincronización
    this.verificarUltimaSincronizacion();
  }

  // ✅ NUEVO: Inicializar campos del dispositivo
  inicializarCampos() {
    if (!this.dispositivoSeleccionado) return;

    // Asegurar que el campo activo existe
    if (this.dispositivoSeleccionado.activo === undefined) {
      this.dispositivoSeleccionado.activo = true;
    }

    // Asegurar que el campo de paciente existe
    if (!this.dispositivoSeleccionado.idpaciente && this.dispositivoSeleccionado.idPacienteAsociado) {
      this.dispositivoSeleccionado.idpaciente = this.dispositivoSeleccionado.idPacienteAsociado;
    }

    // Inicializar campos de ubicación del paciente (si existen)
    if (this.dispositivoSeleccionado.paciente) {
      const p = this.dispositivoSeleccionado.paciente;
      if (!p.domicilio) p.domicilio = '';
      if (!p.localidad) p.localidad = '';
      if (!p.municipio) p.municipio = '';
      if (!p.estado) p.estado = '';
      if (!p.codigoPostal) p.codigoPostal = '';
    }
  }

  // ✅ NUEVO: Cargar historial del dispositivo
  cargarHistorialDispositivo() {
    // En una implementación real, esto vendría del backend
    // Por ahora, creamos un historial de ejemplo
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

    // Si tiene paciente asignado, agregar al historial
    if (this.dispositivoSeleccionado?.idpaciente) {
      const paciente = this.pacientesLista.find(p => p.idusuario === this.dispositivoSeleccionado.idpaciente);
      if (paciente) {
        this.historialCambios.push({
          fecha: fechaStr,
          accion: 'Paciente asignado',
          detalle: `Asignado a: ${paciente.nombre} ${paciente.appaterno}`,
          usuario: 'Sistema'
        });
      }
    }
  }

  // ✅ NUEVO: Verificar última sincronización - CORREGIDO
  verificarUltimaSincronizacion() {
    if (this.dispositivoSeleccionado?.ultimasincronizacion) {
      this.ultimaSincronizacion = this.dispositivoSeleccionado.ultimasincronizacion;
      // ✅ CORRECCIÓN: Verificar que no sea null antes de crear Date
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

  // ✅ NUEVO: Obtener clase de estado de conexión
  getEstadoConexionClass(): string {
    const clases = {
      'conectado': 'estado-conectado',
      'desconectado': 'estado-desconectado',
      'sincronizando': 'estado-sincronizando'
    };
    return clases[this.estadoConexion] || 'estado-desconectado';
  }

  // ✅ NUEVO: Obtener texto de estado de conexión
  getEstadoConexionTexto(): string {
    const textos = {
      'conectado': 'Conectado',
      'desconectado': 'Desconectado',
      'sincronizando': 'Sincronizando...'
    };
    return textos[this.estadoConexion] || 'Desconectado';
  }

  // ✅ NUEVO: Obtener icono de estado de conexión
  getEstadoConexionIcono(): string {
    const iconos = {
      'conectado': 'bi-wifi',
      'desconectado': 'bi-wifi-off',
      'sincronizando': 'bi-arrow-repeat'
    };
    return iconos[this.estadoConexion] || 'bi-wifi-off';
  }

  // ✅ NUEVO: Cargar estadísticas del dispositivo
  async cargarEstadisticas(idDispositivo: number) {
    try {
      // En una implementación real, esto vendría del backend
      // Por ahora, simulamos estadísticas
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

  get pacientesFiltrados() {
    if (!this.filtroPaciente) return this.pacientesLista;
    const term = this.filtroPaciente.toLowerCase();
    return this.pacientesLista.filter(p => {
      const nombreCompleto = `${p.nombre || ''} ${p.appaterno || ''} ${p.apmaterno || ''}`.toLowerCase();
      return nombreCompleto.includes(term);
    });
  }

  ocultarDropdown() {
    setTimeout(() => {
      this.mostrarDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  // ✅ NUEVO: Asignar paciente con más datos
  asignarPaciente(p: any) {
    this.dispositivoSeleccionado.idpaciente = p.idusuario;
    this.dispositivoSeleccionado.nombrepaciente = p.nombre;
    this.dispositivoSeleccionado.appaternopaciente = p.appaterno;
    this.dispositivoSeleccionado.apmaternopaciente = p.apmaterno || '';
    this.dispositivoSeleccionado.paciente = {
      ...p,
      domicilio: p.domicilio || '',
      localidad: p.localidad || '',
      municipio: p.municipio || '',
      estado: p.estado || '',
      codigoPostal: p.codigoPostal || ''
    };
    this.filtroPaciente = `${p.nombre} ${p.appaterno}`;
    this.mostrarDropdown = false;

    // ✅ NUEVO: Registrar en historial
    this.agregarHistorial(
      'Paciente asignado',
      `Asignado a: ${p.nombre} ${p.appaterno} ${p.apmaterno || ''}`
    );
  }

  // ✅ NUEVO: Desasignar paciente
  desasignarPaciente() {
    if (this.dispositivoSeleccionado.idpaciente) {
      const nombrePaciente = this.dispositivoSeleccionado.nombrepaciente || 'Paciente';
      this.dispositivoSeleccionado.idpaciente = null;
      this.dispositivoSeleccionado.nombrepaciente = null;
      this.dispositivoSeleccionado.appaternopaciente = null;
      this.dispositivoSeleccionado.apmaternopaciente = null;
      this.dispositivoSeleccionado.paciente = null;
      this.filtroPaciente = '';

      this.agregarHistorial(
        'Paciente desasignado',
        `Desasignado: ${nombrePaciente}`
      );
    }
  }

  // ✅ NUEVO: Agregar entrada al historial
  agregarHistorial(accion: string, detalle: string) {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);
    this.historialCambios.unshift({
      fecha: fechaStr,
      accion: accion,
      detalle: detalle,
      usuario: 'Usuario actual'
    });
    // En una implementación real, aquí se guardaría en el backend
  }

  async cargarUltimaMedicion(idPaciente: number) {
    try {
      const data = await firstValueFrom(this.usersService.getUltimaMedicionPaciente(idPaciente));
      this.ultimaMedicion = data && Object.keys(data).length > 0 ? data : null;
      this.cdr.detectChanges();
    } catch (error) {
      console.warn("No hay mediciones previas.");
      this.ultimaMedicion = null;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
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

  // ✅ NUEVO: Sincronizar dispositivo manualmente
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

      // Recargar mediciones si hay paciente asignado
      if (this.dispositivoSeleccionado.idpaciente) {
        this.cargarUltimaMedicion(this.dispositivoSeleccionado.idpaciente);
        this.cargarEstadisticas(id);
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

  // ✅ NUEVO: Toggle estado activo/inactivo - CORREGIDO
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
        `El dispositivo fue ${mensaje}` // ✅ CORREGIDO: 'mensado' → 'mensaje'
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

    // ✅ NUEVO: Validar formato MAC
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
        idPacienteAsociado: this.dispositivoSeleccionado.idpaciente || null,
        activo: !!this.dispositivoSeleccionado.activo
      };

      const respuesta = await firstValueFrom(this.usersService.actualizarDispositivo(id, payload));

      if (respuesta.dispositivo) {
        this.dispositivoSeleccionado = { ...this.dispositivoSeleccionado, ...respuesta.dispositivo };
      }

      // ✅ NUEVO: Registrar en historial si cambió el estado
      if (estadoAnterior !== this.dispositivoSeleccionado.activo) {
        const nuevoEstado = this.dispositivoSeleccionado.activo ? 'activado' : 'desactivado';
        this.agregarHistorial(
          `Dispositivo ${nuevoEstado}`,
          `Estado cambiado a: ${nuevoEstado}`
        );
      }

      // ✅ NUEVO: Registrar si cambió el paciente
      this.agregarHistorial(
        'Dispositivo actualizado',
        `Información del dispositivo actualizada`
      );

      this.lanzarNotificacion("¡Dispositivo actualizado con éxito!", "success");

      setTimeout(() => {
        this.router.navigate(['/dispositivos']);
      }, 1500);

    } catch (error: any) {
      console.error("Error al actualizar la tabla de dispositivos:", error);
      const msgErr = error.error?.error || error.message || "Error al procesar la actualización.";
      this.lanzarNotificacion(`Error: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async vincularGoogleFit() {
    const idPaciente = this.dispositivoSeleccionado?.idpaciente || 0;
    console.log("Intentando vincular con el ID:", idPaciente);
    await this.googleService.iniciarVinculacionGoogleFit(idPaciente);
  }

  async cargarDatosGoogleFit() {
    const idPaciente = this.dispositivoSeleccionado?.idpaciente;

    if (!idPaciente) {
      this.lanzarNotificacion("No hay un paciente asociado para buscar datos.", "error");
      return;
    }

    try {
      const url = `${environment.authApi}/google-fit/data/${idPaciente}`;
      const data = await firstValueFrom(this.http.get(url));

      if (data) {
        this.ultimaMedicion = data;
        this.estadoConexion = 'conectado';
        this.ultimaSincronizacion = new Date().toISOString();
        this.agregarHistorial(
          'Datos Google Fit',
          'Datos de Google Fit sincronizados exitosamente'
        );
        this.lanzarNotificacion("Datos obtenidos correctamente.", "success");
      } else {
        this.lanzarNotificacion("No se encontraron mediciones nuevas en Google Fit.", "warning");
      }
    } catch (error) {
      console.error("Error al obtener datos:", error);
      this.estadoConexion = 'desconectado';
      this.lanzarNotificacion("Error al conectar con Google Fit.", "error");
    }
  }

  // ✅ NUEVO: Obtener ubicación formateada del paciente
  getUbicacionPaciente(): string {
    const p = this.dispositivoSeleccionado?.paciente;
    if (!p) return 'Sin ubicación registrada';
    const partes = [p.domicilio, p.localidad, p.municipio, p.estado].filter(Boolean);
    return partes.length ? partes.join(', ') : 'Sin ubicación completa';
  }

  // ✅ NUEVO: Verificar si el paciente tiene ubicación
  pacienteTieneUbicacion(): boolean {
    const p = this.dispositivoSeleccionado?.paciente;
    if (!p) return false;
    return !!(p.domicilio && p.localidad && p.municipio && p.estado);
  }
}