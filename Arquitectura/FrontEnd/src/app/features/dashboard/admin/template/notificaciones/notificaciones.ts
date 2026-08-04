import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { Subscription, firstValueFrom, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, Menu],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.css',
})
export class Notificaciones implements OnInit, OnDestroy {
  public usersService = inject(Users);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  private userSub!: Subscription;
  private refreshTimer: any = null;
  private dataTimeout: any = null;

  // ==========================================================================
  // ESTADO DEL COMPONENTE
  // ==========================================================================
  rolUsuario: string = '';
  loading: boolean = true;
  emailUsuario: string = '';
  idUsuario: number | null = null;
  nombreUsuario: string = '';

  // ==========================================================================
  // DATOS PARA TODOS LOS ROLES
  // ==========================================================================
  // ADMINISTRADOR
  registrosUsuarios: any[] = [];

  // DOCTOR / ADMIN
  citas: any[] = [];
  tratamientos: any[] = [];
  medicamentos: any[] = [];
  dispositivos: any[] = [];

  // PACIENTE
  notificacionesPaciente: any[] = [];
  medicamentosPaciente: any[] = [];
  tratamientosPaciente: any[] = [];

  // ACOMPAÑANTE
  notificacionesAcompanante: any[] = [];
  pacientesAsignados: any[] = [];

  // ==========================================================================
  // CICLO DE VIDA
  // ==========================================================================
  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    console.log('[Notificaciones] Inicializando...');

    this.cargarUsuarioDesdeLocalStorage();

    this.userSub = this.usersService.currentUser$.subscribe({
      next: async (user) => {
        console.log('[Notificaciones] Usuario recibido:', user);

        if (user && user.correo) {
          const rolOriginal = user.rol || '';
          this.rolUsuario = this.normalizarRol(rolOriginal);
          this.emailUsuario = user.correo || user.Email || user.email || '';
          this.idUsuario = user.idusuario || user.uid || user.id || null;
          this.nombreUsuario = user.nombreCompleto || user.nombre || 'Usuario';

          console.log('[Notificaciones] Rol normalizado:', this.rolUsuario);
          console.log('[Notificaciones] Datos del usuario:', {
            rol: this.rolUsuario,
            email: this.emailUsuario,
            id: this.idUsuario,
            nombre: this.nombreUsuario
          });

          this.loading = true;
          await this.cargarNotificacionesPorRol(user);
          this.loading = false;
          this.cdr.detectChanges();

          // Iniciar actualización automática cada 30 segundos
          this.iniciarActualizacionAutomatica();
        } else if (!user && !this.emailUsuario) {
          console.log('[Notificaciones] No hay usuario en observable, intentando desde Auth...');
          await this.cargarUsuarioDesdeAuth();
        }
      },
      error: (error) => {
        console.error('[Notificaciones] Error en suscripción:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });

    this.dataTimeout = setTimeout(() => {
      if (this.loading) {
        console.warn('[Notificaciones] Timeout de carga - forzando fin de loading');
        this.loading = false;
        this.cargarDatosPruebaPorRol(this.rolUsuario);
        this.cdr.detectChanges();
      }
    }, 15000);
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
    }
  }

  // ==========================================================================
  // NORMALIZACIÓN DE ROLES
  // ==========================================================================
  private normalizarRol(rol: string): string {
    if (!rol) return '';

    const rolLower = rol.toLowerCase().trim();

    const rolMap: { [key: string]: string } = {
      'administrador': 'Administrador',
      'admin': 'Administrador',
      'doctor': 'Doctor',
      'medico': 'Doctor',
      'médico': 'Doctor',
      'paciente': 'Paciente',
      'acompañante': 'Acompañante',
      'acompanante': 'Acompañante',
    };

    return rolMap[rolLower] || rol;
  }

  // ==========================================================================
  // CARGA DE USUARIO
  // ==========================================================================
  private cargarUsuarioDesdeLocalStorage() {
    try {
      const storedUser = localStorage.getItem('user_htas');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        this.emailUsuario = userData.correo || '';
        this.rolUsuario = this.normalizarRol(userData.rol || '');
        this.idUsuario = userData.idusuario || userData.uid || null;
        this.nombreUsuario = userData.nombreCompleto || userData.nombre || 'Usuario';

        console.log('[Notificaciones] Usuario cargado desde localStorage:', {
          rol: this.rolUsuario,
          email: this.emailUsuario,
          id: this.idUsuario
        });

        if (this.emailUsuario) {
          setTimeout(() => {
            this.cargarNotificacionesPorRol(userData);
          }, 100);
        }
      }
    } catch (e) {
      console.error('[Notificaciones] Error al cargar usuario de localStorage:', e);
    }
  }

  private async cargarUsuarioDesdeAuth() {
    try {
      const user = this.auth.currentUser;
      if (user && user.email) {
        this.emailUsuario = user.email;
        console.log('[Notificaciones] Usuario cargado desde Auth:', user.email);

        try {
          const userData = await firstValueFrom(
            this.usersService.getUsuarioById(this.emailUsuario).pipe(
              timeout(5000),
              catchError(() => of(null))
            )
          );
          if (userData) {
            this.rolUsuario = this.normalizarRol(userData.rol || '');
            this.idUsuario = userData.idusuario || userData.id || null;
            this.nombreUsuario = userData.nombreCompleto || userData.nombre || 'Usuario';
            await this.cargarNotificacionesPorRol(userData);
          }
        } catch (error) {
          console.warn('[Notificaciones] No se pudo obtener rol del usuario:', error);
        }
      }
    } catch (error) {
      console.error('[Notificaciones] Error al cargar usuario de Auth:', error);
    }
  }

  // ==========================================================================
  // ACTUALIZACIÓN AUTOMÁTICA
  // ==========================================================================
  private iniciarActualizacionAutomatica() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      console.log('[Notificaciones] Actualizando datos en tiempo real...');
      if (this.loading) return;

      const rol = this.rolUsuario;
      switch (rol) {
        case 'Administrador':
          this.cargarDatosAdmin().finally(() => this.cdr.detectChanges());
          break;
        case 'Doctor':
          this.cargarDatosMedico().finally(() => this.cdr.detectChanges());
          break;
        case 'Paciente':
          this.cargarDatosPaciente().finally(() => this.cdr.detectChanges());
          break;
        case 'Acompañante':
          this.cargarDatosAcompanante().finally(() => this.cdr.detectChanges());
          break;
      }
    }, 30000);
  }

  // ==========================================================================
  // CARGA DE NOTIFICACIONES POR ROL
  // ==========================================================================
  async cargarNotificacionesPorRol(user: any) {
    const rol = this.rolUsuario;
    console.log(`[Notificaciones] Cargando datos para rol: ${rol}`);

    try {
      this.resetData();

      if (rol === 'Administrador') {
        await this.cargarDatosAdmin();
      }
      else if (rol === 'Doctor') {
        await this.cargarDatosMedico();
      }
      else if (rol === 'Paciente') {
        await this.cargarDatosPaciente();
      }
      else if (rol === 'Acompañante') {
        await this.cargarDatosAcompanante();
      } else {
        console.warn(`[Notificaciones] Rol no reconocido: ${rol}, usando datos de prueba`);
        this.cargarDatosPruebaPorRol(rol);
      }
    } catch (error) {
      console.error('[Notificaciones] Error cargando notificaciones:', error);
      this.cargarDatosPruebaPorRol(rol);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private resetData() {
    this.registrosUsuarios = [];
    this.citas = [];
    this.tratamientos = [];
    this.medicamentos = [];
    this.dispositivos = [];
    this.notificacionesPaciente = [];
    this.medicamentosPaciente = [];
    this.tratamientosPaciente = [];
    this.notificacionesAcompanante = [];
    this.pacientesAsignados = [];
  }

  // ==========================================================================
  // CARGA DE DATOS POR ROL
  // ==========================================================================

  // -------------------- ADMIN --------------------
  private async cargarDatosAdmin() {
    console.log('[Admin] Cargando datos del panel de administrador...');

    try {
      // Usuarios
      try {
        const usuarios = await firstValueFrom(
          this.usersService.getUsuariosBackend().pipe(timeout(8000))
        );
        if (usuarios && usuarios.length > 0) {
          this.registrosUsuarios = usuarios;
          console.log(`[Admin] ${usuarios.length} usuarios cargados`);
        }
      } catch (error) {
        console.error('[Admin] Error cargando usuarios:', error);
      }

      // Citas
      try {
        const citasData = await firstValueFrom(
          this.usersService.getAllCitas().pipe(timeout(8000))
        );
        if (citasData && citasData.length > 0) {
          this.citas = this.formatearCitas(citasData);
          console.log(`[Admin] ${this.citas.length} citas cargadas`);
        }
      } catch (error) {
        console.error('[Admin] Error cargando citas:', error);
      }

      // Tratamientos
      try {
        const tratamientosData = await firstValueFrom(
          this.usersService.getTratamientos().pipe(timeout(8000))
        );
        if (tratamientosData && tratamientosData.length > 0) {
          this.tratamientos = tratamientosData;
          console.log(`[Admin] ${tratamientosData.length} tratamientos cargados`);
        }
      } catch (error) {
        console.error('[Admin] Error cargando tratamientos:', error);
      }

      // Medicamentos
      try {
        const medicamentosData = await firstValueFrom(
          this.usersService.getMedicamentos().pipe(timeout(8000))
        );
        if (medicamentosData && medicamentosData.length > 0) {
          this.medicamentos = medicamentosData;
          console.log(`[Admin] ${medicamentosData.length} medicamentos cargados`);
        }
      } catch (error) {
        console.error('[Admin] Error cargando medicamentos:', error);
      }

      // Dispositivos
      try {
        const dispositivosData = await firstValueFrom(
          this.usersService.getDispositivos().pipe(timeout(8000))
        );
        if (dispositivosData && dispositivosData.length > 0) {
          this.dispositivos = dispositivosData;
          console.log(`[Admin] ${dispositivosData.length} dispositivos cargados`);
        }
      } catch (error) {
        console.error('[Admin] Error cargando dispositivos:', error);
      }

      if (this.registrosUsuarios.length === 0 && this.citas.length === 0) {
        console.log('[Admin] Sin datos reales, cargando datos de prueba');
        this.cargarDatosPruebaAdmin();
      }

    } catch (error) {
      console.error('[Admin] Error general cargando datos:', error);
      this.cargarDatosPruebaAdmin();
    }
  }

  // -------------------- DOCTOR --------------------
  private async cargarDatosMedico() {
    console.log('[Doctor] Cargando datos del panel médico...');

    try {
      // Citas
      const citasData = await firstValueFrom(
        this.usersService.getAllCitas().pipe(timeout(8000))
      );
      if (citasData && citasData.length > 0) {
        this.citas = this.formatearCitas(citasData);
        console.log(`[Doctor] ${this.citas.length} citas cargadas`);
      }

      // Tratamientos
      const tratamientosData = await firstValueFrom(
        this.usersService.getTratamientos().pipe(timeout(8000))
      );
      if (tratamientosData && tratamientosData.length > 0) {
        this.tratamientos = tratamientosData;
        console.log(`[Doctor] ${tratamientosData.length} tratamientos cargados`);
      }

      // Medicamentos
      const medicamentosData = await firstValueFrom(
        this.usersService.getMedicamentos().pipe(timeout(8000))
      );
      if (medicamentosData && medicamentosData.length > 0) {
        this.medicamentos = medicamentosData;
        console.log(`[Doctor] ${medicamentosData.length} medicamentos cargados`);
      }

      // Dispositivos
      const dispositivosData = await firstValueFrom(
        this.usersService.getDispositivos().pipe(timeout(8000))
      );
      if (dispositivosData && dispositivosData.length > 0) {
        this.dispositivos = dispositivosData;
        console.log(`[Doctor] ${dispositivosData.length} dispositivos cargados`);
      }

      if (this.citas.length === 0) {
        this.cargarDatosPruebaMedico();
      }

    } catch (error) {
      console.error('[Doctor] Error general:', error);
      this.cargarDatosPruebaMedico();
    }
  }

  // -------------------- PACIENTE --------------------
  private async cargarDatosPaciente() {
    console.log('[Paciente] Cargando datos del panel paciente...');

    if (!this.emailUsuario) {
      console.warn('[Paciente] No hay email de usuario');
      this.cargarDatosPruebaPaciente();
      return;
    }

    try {
      // Citas del paciente
      const citasData = await firstValueFrom(
        this.usersService.getMisCitas(this.emailUsuario).pipe(timeout(8000))
      );
      if (citasData && citasData.length > 0) {
        this.notificacionesPaciente = this.formatearCitasPaciente(citasData);
        console.log(`[Paciente] ${this.notificacionesPaciente.length} citas cargadas`);
      }

      // Medicamentos
      const medicamentosData = await firstValueFrom(
        this.usersService.getMedicamentos().pipe(timeout(8000))
      );
      if (medicamentosData && medicamentosData.length > 0) {
        this.medicamentosPaciente = medicamentosData;
        console.log(`[Paciente] ${medicamentosData.length} medicamentos cargados`);
      }

      // Tratamientos del paciente (si tiene ID)
      if (this.idUsuario) {
        try {
          const tratamientosData = await firstValueFrom(
            this.usersService.getTratamientosByPaciente(this.idUsuario).pipe(timeout(8000))
          );
          if (tratamientosData && tratamientosData.length > 0) {
            this.tratamientosPaciente = tratamientosData;
            console.log(`[Paciente] ${tratamientosData.length} tratamientos cargados`);
          }
        } catch (error) {
          console.warn('[Paciente] No se pudieron cargar tratamientos:', error);
        }
      }

      if (this.notificacionesPaciente.length === 0) {
        this.cargarDatosPruebaPaciente();
      }

    } catch (error) {
      console.error('[Paciente] Error general:', error);
      this.cargarDatosPruebaPaciente();
    }
  }

  // -------------------- ACOMPAÑANTE --------------------
  private async cargarDatosAcompanante() {
    console.log('[Acompañante] Cargando datos del panel acompañante...');

    if (!this.idUsuario) {
      console.warn('[Acompañante] No hay ID de usuario');
      this.cargarDatosPruebaAcompanante();
      return;
    }

    try {
      // Notificaciones del acompañante
      const notificaciones = await firstValueFrom(
        this.usersService.getNotificacionesAcompanante(this.idUsuario).pipe(
          timeout(8000),
          catchError(() => of([]))
        )
      );

      if (notificaciones && notificaciones.length > 0) {
        this.notificacionesAcompanante = notificaciones;
        console.log(`[Acompañante] ${notificaciones.length} notificaciones cargadas`);
      }

      // Pacientes asignados
      try {
        const pacientes = await firstValueFrom(
          this.usersService.getPacientesAsignados(this.idUsuario).pipe(timeout(8000))
        );
        if (pacientes && pacientes.length > 0) {
          this.pacientesAsignados = pacientes;
          console.log(`[Acompañante] ${pacientes.length} pacientes asignados cargados`);
        }
      } catch (error) {
        console.warn('[Acompañante] No se pudieron cargar pacientes asignados:', error);
      }

      if (this.notificacionesAcompanante.length === 0) {
        this.cargarDatosPruebaAcompanante();
      }

    } catch (error) {
      console.error('[Acompañante] Error cargando notificaciones:', error);
      this.cargarDatosPruebaAcompanante();
    }
  }

  // ==========================================================================
  // DATOS DE PRUEBA POR ROL
  // ==========================================================================
  private cargarDatosPruebaPorRol(rol: string) {
    const rolLower = rol.toLowerCase();
    if (rolLower === 'administrador' || rolLower === 'admin') {
      this.cargarDatosPruebaAdmin();
    } else if (rolLower === 'doctor' || rolLower === 'medico') {
      this.cargarDatosPruebaMedico();
    } else if (rolLower === 'paciente') {
      this.cargarDatosPruebaPaciente();
    } else if (rolLower === 'acompañante' || rolLower === 'acompanante') {
      this.cargarDatosPruebaAcompanante();
    } else {
      this.cargarDatosPruebaAdmin();
    }
  }

  private cargarDatosPruebaAdmin() {
    console.log('[Prueba] Cargando datos de prueba para Admin');
    this.registrosUsuarios = [
      { idusuario: 1, nombre: 'Admin Test', rol: 'Administrador', correo: 'admin@test.com' },
      { idusuario: 2, nombre: 'Dr. Juan Pérez', rol: 'Doctor', correo: 'juan@test.com' },
      { idusuario: 3, nombre: 'María González', rol: 'Paciente', correo: 'maria@test.com' },
      { idusuario: 4, nombre: 'Carlos López', rol: 'Acompañante', correo: 'carlos@test.com' }
    ];

    this.citas = [
      { id: 1, fecha: '15/08/2024', hora: '10:00', motivo: 'Consulta General', paciente: 'María González', estado: 'Confirmada' },
      { id: 2, fecha: '16/08/2024', hora: '11:30', motivo: 'Revisión Cardiológica', paciente: 'Pedro Ramírez', estado: 'Programada' },
      { id: 3, fecha: '17/08/2024', hora: '09:00', motivo: 'Control Diabético', paciente: 'Ana Martínez', estado: 'Cancelada' },
      { id: 4, fecha: '18/08/2024', hora: '14:00', motivo: 'Consulta Nutricional', paciente: 'Luis Torres', estado: 'Confirmada' }
    ];

    this.tratamientos = [
      { id: 1, nombre: 'Losartán', dosis: '50mg', frecuenciaHoras: 24, paciente: 'María González' },
      { id: 2, nombre: 'Metformina', dosis: '850mg', frecuenciaHoras: 12, paciente: 'Pedro Ramírez' },
      { id: 3, nombre: 'Omeprazol', dosis: '20mg', frecuenciaHoras: 24, paciente: 'Ana Martínez' }
    ];

    this.medicamentos = [
      { id: 1, nombreComercial: 'Paracetamol', sustanciaActiva: 'Acetaminofén', presentacion: 'Tabletas 500mg', laboratorio: 'Bayer' },
      { id: 2, nombreComercial: 'Ibuprofeno', sustanciaActiva: 'Ibuprofeno', presentacion: 'Tabletas 400mg', laboratorio: 'Pfizer' },
      { id: 3, nombreComercial: 'Amoxicilina', sustanciaActiva: 'Amoxicilina', presentacion: 'Cápsulas 500mg', laboratorio: 'GSK' }
    ];

    this.dispositivos = [
      { id: 1, nombre: 'Monitor Cardíaco', direccionMac: '00:1A:2B:3C:4D:5E', paciente: 'María González' },
      { id: 2, nombre: 'Bomba de Insulina', direccionMac: '00:1A:2B:3C:4D:5F', paciente: 'Pedro Ramírez' },
      { id: 3, nombre: 'Oxímetro', direccionMac: '00:1A:2B:3C:4D:60', paciente: 'Ana Martínez' }
    ];
  }

  private cargarDatosPruebaMedico() {
    console.log('[Prueba] Cargando datos de prueba para Médico');
    this.citas = [
      { id: 1, fecha: '15/08/2024', hora: '10:00', motivo: 'Consulta General', paciente: 'María González', estado: 'Confirmada' },
      { id: 2, fecha: '16/08/2024', hora: '11:30', motivo: 'Revisión Cardiológica', paciente: 'Pedro Ramírez', estado: 'Programada' }
    ];
    this.tratamientos = [
      { id: 1, nombre: 'Losartán', dosis: '50mg', frecuenciaHoras: 24, paciente: 'María González' },
      { id: 2, nombre: 'Metformina', dosis: '850mg', frecuenciaHoras: 12, paciente: 'Pedro Ramírez' }
    ];
    this.medicamentos = [
      { id: 1, nombreComercial: 'Paracetamol', sustanciaActiva: 'Acetaminofén', presentacion: 'Tabletas 500mg' },
      { id: 2, nombreComercial: 'Ibuprofeno', sustanciaActiva: 'Ibuprofeno', presentacion: 'Tabletas 400mg' }
    ];
    this.dispositivos = [
      { id: 1, nombre: 'Monitor Cardíaco', direccionMac: '00:1A:2B:3C:4D:5E' }
    ];
  }

  private cargarDatosPruebaPaciente() {
    console.log('[Prueba] Cargando datos de prueba para Paciente');
    this.notificacionesPaciente = [
      { id: 1, tipo: 'Cita Médica', mensaje: 'Consulta General - Confirmada', fecha: '15/08/2024', hora: '10:00', estado: 'Confirmada', doctor: 'Dr. Juan Pérez' },
      { id: 2, tipo: 'Cita Médica', mensaje: 'Revisión Cardiológica - Programada', fecha: '16/08/2024', hora: '11:30', estado: 'Programada', doctor: 'Dra. Ana Gómez' }
    ];
    this.tratamientosPaciente = [
      { id: 1, nombre: 'Losartán', dosis: '50mg', frecuenciaHoras: 24, fechaInicio: '01/08/2024', fechaFin: '01/09/2024', activo: true },
      { id: 2, nombre: 'Metformina', dosis: '850mg', frecuenciaHoras: 12, fechaInicio: '15/07/2024', fechaFin: '15/08/2024', activo: false }
    ];
    this.medicamentosPaciente = [
      { id: 1, nombreComercial: 'Paracetamol', sustanciaActiva: 'Acetaminofén', presentacion: 'Tabletas 500mg' },
      { id: 2, nombreComercial: 'Ibuprofeno', sustanciaActiva: 'Ibuprofeno', presentacion: 'Tabletas 400mg' }
    ];
  }

  private cargarDatosPruebaAcompanante() {
    console.log('[Prueba] Cargando datos de prueba para Acompañante');
    this.notificacionesAcompanante = [
      { id: 1, tipo: 'Alerta', mensaje: 'Recordatorio: Tomar medicamento', fecha: 'Hoy, 10:00 AM' },
      { id: 2, tipo: 'Monitoreo', mensaje: 'Signos vitales estables', fecha: 'Hoy, 08:30 AM' },
      { id: 3, tipo: 'Alerta', mensaje: 'Cita médica programada', fecha: 'Mañana, 11:00 AM' }
    ];
    this.pacientesAsignados = [
      { id: 1, nombre: 'María González', apPaterno: 'González', correo: 'maria@test.com', telefono: '555-1234' },
      { id: 2, nombre: 'Pedro Ramírez', apPaterno: 'Ramírez', correo: 'pedro@test.com', telefono: '555-5678' }
    ];
  }

  // ==========================================================================
  // MÉTODOS DE FORMATEO
  // ==========================================================================
  formatearCitas(citasData: any[]): any[] {
    if (!citasData || citasData.length === 0) return [];

    return citasData.map((c: any) => {
      let fechaFormateada = 'Sin fecha';
      if (c.fechacita) {
        try {
          let fechaISO = c.fechacita;
          if (fechaISO.includes('T')) fechaISO = fechaISO.split('T')[0];
          const partes = fechaISO.split('-');
          if (partes.length === 3) {
            fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
        } catch (e) {
          fechaFormateada = c.fechacita;
        }
      }

      let pacienteNombre = 'Paciente';
      if (c.nombrepaciente) {
        pacienteNombre = `${c.nombrepaciente || ''} ${c.appaternopaciente || ''}`.trim();
      } else if (c.paciente) {
        pacienteNombre = c.paciente;
      } else if (c.nombre) {
        pacienteNombre = c.nombre;
      }

      return {
        id: c.idcita || c.id || Math.random().toString(36),
        fecha: fechaFormateada,
        hora: c.horacita ? c.horacita.substring(0, 5) : 'S/H',
        motivo: c.motivo || c.descripcion || 'Consulta Médica',
        paciente: pacienteNombre,
        estado: c.estado || c.estatus || 'Programada',
        modalidad: c.modalidad || 'Presencial'
      };
    });
  }

  formatearCitasPaciente(citasData: any[]): any[] {
    if (!citasData || citasData.length === 0) return [];

    return citasData.map((c: any) => {
      let fechaFormateada = 'Sin fecha';
      if (c.fechacita) {
        try {
          let fechaISO = c.fechacita;
          if (fechaISO.includes('T')) fechaISO = fechaISO.split('T')[0];
          const partes = fechaISO.split('-');
          if (partes.length === 3) {
            fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
        } catch (e) {
          fechaFormateada = c.fechacita;
        }
      }

      return {
        id: c.idcita || c.id,
        tipo: 'Cita Médica',
        mensaje: `${c.motivo || 'Consulta'} - ${c.estado || 'Programada'}`,
        fecha: fechaFormateada,
        hora: c.horacita ? c.horacita.substring(0, 5) : 'S/H',
        estado: c.estado || 'Programada',
        doctor: `${c.nombremedico || ''} ${c.appaternomedico || ''}`.trim() || 'Médico'
      };
    });
  }

  // ==========================================================================
  // MÉTODOS DE UTILIDAD PARA EL TEMPLATE
  // ==========================================================================
  obtenerIconoClase(tipo: string): string {
    if (!tipo) return 'bg-secondary';
    const t = tipo.toLowerCase();
    if (t.includes('cita')) return 'bg-blue';
    if (t.includes('tratamiento')) return 'bg-purple';
    if (t.includes('dispositivo')) return 'bg-orange';
    if (t.includes('medicamento') || t.includes('toma')) return 'bg-green';
    if (t.includes('asign') || t.includes('acompañante')) return 'bg-red';
    return 'bg-secondary';
  }

  obtenerIconoNotificacion(tipo: string): string {
    if (!tipo) return 'bi bi-bell-fill';
    const t = tipo.toLowerCase();
    if (t.includes('cita')) return 'bi bi-calendar-event-fill';
    if (t.includes('tratamiento')) return 'bi bi-capsules';
    if (t.includes('dispositivo')) return 'bi bi-cpu-fill';
    if (t.includes('medicamento') || t.includes('toma')) return 'bi bi-droplet-fill';
    if (t.includes('asign') || t.includes('acompañante')) return 'bi bi-person-heart';
    return 'bi bi-bell-fill';
  }

  getEstadoClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'confirmada':
      case 'activa':
      case 'programada':
        return 'badge-success';
      case 'pendiente':
        return 'badge-warning';
      case 'cancelada':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  }
}