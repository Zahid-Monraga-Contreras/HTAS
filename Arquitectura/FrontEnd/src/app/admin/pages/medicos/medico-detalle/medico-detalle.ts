import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleService } from '../../../../auth/services/google';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// ✅ NUEVO: Interfaz para el historial del médico
interface HistorialMedico {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

@Component({
  selector: 'app-medico-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
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

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // ✅ NUEVO: Historial de cambios del médico
  historialCambios: HistorialMedico[] = [];
  mostrarHistorial = false;

  // ✅ NUEVO: Lista de pacientes atendidos
  pacientesAtendidos: any[] = [];
  mostrarPacientes = false;

  // ✅ NUEVO: Estadísticas del médico
  estadisticas: {
    totalPacientes: number;
    citasCompletadas: number;
    citasPendientes: number;
    promedioConsultas: number;
  } | null = null;

  ngOnInit() {
    // Evita que el servidor (SSR) intente leer "history", lo cual rompía la compilación inicial
    if (isPlatformBrowser(this.platformId)) {
      const state = history.state;
      if (state && state.usuario) {
        this.usuarioSeleccionado = { ...state.usuario };
        this.inicializarCampos();
        this.cargarDatosAdicionales();
      } else {
        this.router.navigate(['/medicos']);
      }
    }
  }

  // ✅ NUEVO: Inicializar campos del médico
  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    // Asegurar que los campos de ubicación existan
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

    // Asegurar que los campos temporales existan para el formulario
    if (!this.usuarioSeleccionado.tempNombre) {
      this.usuarioSeleccionado.tempNombre = this.usuarioSeleccionado.nombre || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoPaterno) {
      this.usuarioSeleccionado.tempApellidoPaterno = this.usuarioSeleccionado.apPaterno || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoMaterno) {
      this.usuarioSeleccionado.tempApellidoMaterno = this.usuarioSeleccionado.apMaterno || '';
    }
  }

  // ✅ NUEVO: Cargar datos adicionales
  async cargarDatosAdicionales() {
    if (!this.usuarioSeleccionado) return;

    // Cargar historial
    this.cargarHistorialMedico();

    // Cargar estadísticas (simuladas)
    this.estadisticas = {
      totalPacientes: Math.floor(Math.random() * 50) + 10,
      citasCompletadas: Math.floor(Math.random() * 30) + 5,
      citasPendientes: Math.floor(Math.random() * 10) + 2,
      promedioConsultas: Math.floor(Math.random() * 15) + 5
    };

    // Cargar pacientes atendidos (simulados)
    this.pacientesAtendidos = [
      { id: 1, nombre: 'María López González', fechaUltimaCita: '2026-07-01', motivo: 'Consulta general' },
      { id: 2, nombre: 'Juan Pérez García', fechaUltimaCita: '2026-06-28', motivo: 'Control de rutina' },
      { id: 3, nombre: 'Ana Martínez Ruiz', fechaUltimaCita: '2026-06-25', motivo: 'Dolor de cabeza' }
    ];

    // Si tiene especialidad, agregar al historial
    if (this.usuarioSeleccionado.especialidad) {
      this.agregarHistorial(
        'Especialidad asignada',
        `Especialidad: ${this.usuarioSeleccionado.especialidad}`
      );
    }
  }

  // ✅ NUEVO: Cargar historial del médico
  cargarHistorialMedico() {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);

    this.historialCambios = [
      {
        fecha: fechaStr,
        accion: 'Médico registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      }
    ];
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
  }

  // ✅ NUEVO: Obtener estado del médico
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

  // ✅ NUEVO: Formatear CURP
  formatearCURP() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = this.usuarioSeleccionado.curp.toUpperCase().trim();
      this.cdr.detectChanges();
    }
  }

  // ✅ NUEVO: Formatear código postal
  formatearCodigoPostal() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.codigoPostal) {
      const cp = this.usuarioSeleccionado.codigoPostal.replace(/\D/g, '').slice(0, 5);
      this.usuarioSeleccionado.codigoPostal = cp;
      this.cdr.detectChanges();
    }
  }

  // ✅ NUEVO: Capitalizar texto
  capitalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.split(' ').map(palabra =>
      palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
  }

  // ✅ NUEVO: Formatear campo de texto
  formatearCampoTexto(campo: string) {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado[campo]) {
      this.usuarioSeleccionado[campo] = this.capitalizarTexto(this.usuarioSeleccionado[campo]);
      this.cdr.detectChanges();
    }
  }

  // ✅ NUEVO: Obtener ubicación formateada
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

  // ✅ NUEVO: Verificar si tiene ubicación completa
  tieneUbicacionCompleta(): boolean {
    const u = this.usuarioSeleccionado;
    if (!u) return false;
    return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
  }

  // ✅ NUEVO: Validar campos antes de guardar
  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.tempNombre || u.tempNombre.trim().length < 2) {
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

    return { valido: true, mensaje: '' };
  }

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  volver() {
    this.location.back();
  }

  // Controlador de disparo para el Toast Premium
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

    // Recuperar valores limpiando espacios de los ngModel temporales
    const nombre = (this.usuarioSeleccionado.tempNombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();
    const correoFinal = this.usuarioSeleccionado.correo || this.usuarioSeleccionado.Correo;

    // Validación de campos obligatorios en el Frontend
    if (!nombre || !apPaterno || !correoFinal) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo electrónico son requeridos.", "warning");
      return;
    }

    // ✅ NUEVO: Validaciones adicionales
    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
      return;
    }

    // ✅ NUEVO: Guardar estado anterior para historial
    const nombreAnterior = this.usuarioSeleccionado.nombre || '';
    const apPaternoAnterior = this.usuarioSeleccionado.apPaterno || '';

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      // Reconciliación del ID único del médico en el sistema
      const idFinal = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

      // Enviamos el payload manteniendo tanto camelCase como snake_case
      const datosActualizados = {
        nombre: nombre,
        apPaterno: apPaterno,
        appaterno: apPaterno,
        apMaterno: apMaterno,
        apmaterno: apMaterno,
        correo: correoFinal,
        telefono: this.usuarioSeleccionado.telefono || 'Sin teléfono',
        genero: this.usuarioSeleccionado.genero || 'No especificado',
        especialidad: this.usuarioSeleccionado.especialidad || 'General',
        direccionClinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        direccionclinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        rol: this.usuarioSeleccionado.rol || 'Médico',
        // ✅ NUEVOS CAMPOS
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento || null,
        curp: (this.usuarioSeleccionado.curp || '').toUpperCase().trim(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      // Despacho condicional basado en la persistencia origen
      if (this.usuarioSeleccionado.fuente === 'Firebase') {
        await this.googleService.updateUsuario(idFinal, datosActualizados);
      } else {
        await firstValueFrom(this.usersService.updateUsuario(idFinal, datosActualizados));
      }

      // ✅ NUEVO: Registrar en historial
      if (nombreAnterior !== nombre || apPaternoAnterior !== apPaterno) {
        this.agregarHistorial(
          'Datos personales actualizados',
          `De: "${nombreAnterior} ${apPaternoAnterior}" → "${nombre} ${apPaterno}"`
        );
      } else {
        this.agregarHistorial(
          'Información actualizada',
          'Datos del médico actualizados'
        );
      }

      this.lanzarNotificacion("¡Éxito! Los datos del médico se actualizaron correctamente.", "success");

      // Redirección diferida fluida
      setTimeout(() => {
        this.router.navigate(['/medicos']);
      }, 2000);

    } catch (error) {
      console.error('Error detallado al guardar:', error);
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }
}