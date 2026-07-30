import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DoctorMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface Notificacion {
    id: number;
    tipo: 'cita' | 'tratamiento' | 'medicamento' | 'dispositivo' | 'paciente' | 'sistema';
    titulo: string;
    mensaje: string;
    fecha: string;
    leida: boolean;
    icono: string;
    color: string;
    accion?: string;
    idReferencia?: number;
}

@Component({
    selector: 'app-doctor-notificaciones',
    standalone: true,
    imports: [CommonModule, FormsModule, DoctorMenu],
    templateUrl: './notificaciones.html',
    styleUrls: ['./notificaciones.css']
})
export class DoctorNotificaciones implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private router = inject(Router);

    isLoading = true;
    notificaciones: Notificacion[] = [];
    notificacionesFiltradas: Notificacion[] = [];
    filterEstado: string = 'todas';

    estadisticas = {
        total: 0,
        noLeidas: 0,
        leidas: 0
    };

    mostrarModalDetalle = false;
    notificacionSeleccionada: Notificacion | null = null;

    mostrarModalConfirmacion = false;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        icono: '',
        accion: ''
    };
    notificacionParaEliminar: Notificacion | null = null;

    mostrarToast = false;
    mensajeToast = '';
    tipoToast: 'success' | 'error' | 'warning' = 'success';
    private toastTimeout: any = null;

    private eventos: any[] = [];

    doctorId: number | null = null;
    doctorName: string = '';
    userEmail: string = '';

    // Datos reales
    citasReales: any[] = [];
    pacientesReales: any[] = [];
    tratamientosReales: any[] = [];
    medicamentosReales: any[] = [];
    dispositivosReales: any[] = [];

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.userEmail = userData.correo || '';
                    this.doctorName = userData.nombre || 'Doctor';
                    this.doctorId = userData.idusuario || userData.uid || null;
                } catch (e) {
                    console.error('Error al parsear userData:', e);
                }
            }

            if (!this.userEmail) {
                const user = this.auth.currentUser;
                if (user) {
                    this.userEmail = user.email || '';
                    this.doctorName = user.displayName || 'Doctor';
                }
            }

            if (this.doctorId) {
                await this.cargarDatosReales();
            }

            await this.generarNotificacionesDesdeDatos();

            this.inicializarEventListeners();

            this.calcularEstadisticas();
            this.aplicarFiltro('todas');

        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
        } finally {
            this.isLoading = false;
            this.cdr.markForCheck();
        }
    }

    ngOnDestroy() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        if (this.eventos) {
            this.eventos.forEach(e => e.unsubscribe?.());
        }
    }

    private async cargarDatosReales() {
        try {
            // Obtener todas las citas
            const citas = await firstValueFrom(
                this.usersService.getAllCitas()
            );
            if (Array.isArray(citas) && citas.length > 0) {
                this.citasReales = citas;
            }

            // Obtener todos los usuarios (pacientes)
            const usuarios = await firstValueFrom(
                this.usersService.getUsuariosBackend()
            );
            if (Array.isArray(usuarios) && usuarios.length > 0) {
                this.pacientesReales = usuarios.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );
            }

            // Obtener tratamientos
            const tratamientos = await firstValueFrom(
                this.usersService.getTratamientos()
            );
            if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                this.tratamientosReales = tratamientos;
            }

            // Obtener medicamentos
            const medicamentos = await firstValueFrom(
                this.usersService.getMedicamentos()
            );
            if (Array.isArray(medicamentos) && medicamentos.length > 0) {
                this.medicamentosReales = medicamentos;
            }

            // Obtener dispositivos
            const dispositivos = await firstValueFrom(
                this.usersService.getDispositivos()
            );
            if (Array.isArray(dispositivos) && dispositivos.length > 0) {
                this.dispositivosReales = dispositivos;
            }

        } catch (error) {
            console.error('Error al cargar datos reales:', error);
        }
    }

    private async generarNotificacionesDesdeDatos() {
        this.notificaciones = [];

        // Generar notificaciones de citas
        if (this.citasReales && this.citasReales.length > 0) {
            const citasActivas = this.citasReales.filter(c =>
                c.estado !== 'Cancelada' && c.estado !== 'Completada'
            );

            citasActivas.forEach((cita, index) => {
                const fechaCita = cita.fechacita || cita.fecha || '';
                const fechaFormateada = this.formatearFechaNotificacion(fechaCita);

                let horaCita = cita.horacita || cita.hora || '';
                if (horaCita.includes(':')) {
                    const partes = horaCita.split(':');
                    horaCita = partes[0] + ':' + partes[1];
                }

                // Obtener nombre del paciente de la cita
                const nombrePaciente = cita.nombrepaciente || cita.nombrePaciente || 'Paciente';
                const apPaterno = cita.appaternopaciente || cita.apPaternoPaciente || '';
                const pacienteCompleto = `${nombrePaciente} ${apPaterno}`.trim();

                this.notificaciones.push({
                    id: 1000 + index,
                    tipo: 'cita',
                    titulo: 'Nueva cita agendada',
                    mensaje: `Cita con ${pacienteCompleto} el ${fechaFormateada} a las ${horaCita} - ${cita.motivo || 'Consulta medica'}`,
                    fecha: cita.created_at || new Date().toISOString(),
                    leida: false,
                    icono: 'bi-calendar-event',
                    color: '#b0001e',
                    accion: '/doctor/citas',
                    idReferencia: cita.idcita || cita.id
                });
            });
        }

        // Generar notificaciones de pacientes nuevos
        if (this.pacientesReales && this.pacientesReales.length > 0) {
            const pacientesRecientes = this.pacientesReales.slice(0, 5);
            pacientesRecientes.forEach((paciente, index) => {
                const nombreCompleto = `${paciente.nombre || ''} ${paciente.apPaterno || ''} ${paciente.apMaterno || ''}`.trim();
                const fecha = paciente.created_at || new Date().toISOString();
                const fechaFormateada = this.formatearFechaNotificacion(fecha);

                this.notificaciones.push({
                    id: 5000 + index,
                    tipo: 'paciente',
                    titulo: 'Nuevo paciente registrado',
                    mensaje: `${nombreCompleto || 'Paciente'} se ha registrado en el sistema`,
                    fecha: fecha,
                    leida: false,
                    icono: 'bi-person-plus',
                    color: '#3b82f6',
                    accion: '/doctor/pacientes',
                    idReferencia: paciente.idusuario
                });
            });
        }

        // Generar notificaciones de tratamientos
        if (this.tratamientosReales && this.tratamientosReales.length > 0) {
            const tratamientosActivos = this.tratamientosReales.filter(t =>
                t.activo === true || t.activo === 'true' || t.activo === 1
            );

            tratamientosActivos.forEach((tratamiento, index) => {
                const medicamento = tratamiento.nombremedicamento || 'Medicamento';
                const fecha = tratamiento.created_at || new Date().toISOString();
                const fechaFormateada = this.formatearFechaNotificacion(fecha);

                this.notificaciones.push({
                    id: 2000 + index,
                    tipo: 'tratamiento',
                    titulo: 'Tratamiento iniciado',
                    mensaje: `Tratamiento con ${medicamento} - ${tratamiento.dosis || ''} (${fechaFormateada})`,
                    fecha: fecha,
                    leida: false,
                    icono: 'bi-capsule',
                    color: '#10b981',
                    accion: '/doctor/tratamientos',
                    idReferencia: tratamiento.idtratamiento
                });
            });
        }

        // Generar notificaciones de medicamentos recetados
        if (this.medicamentosReales && this.medicamentosReales.length > 0) {
            this.medicamentosReales.forEach((medicamento, index) => {
                if (medicamento.totaltratamientos > 0) {
                    const fecha = medicamento.created_at || new Date().toISOString();
                    const fechaFormateada = this.formatearFechaNotificacion(fecha);

                    this.notificaciones.push({
                        id: 3000 + index,
                        tipo: 'medicamento',
                        titulo: 'Medicamento en uso',
                        mensaje: `${medicamento.nombrecomercial || 'Medicamento'} - ${medicamento.presentacion || ''} (${fechaFormateada})`,
                        fecha: fecha,
                        leida: false,
                        icono: 'bi-capsule',
                        color: '#7c3aed',
                        accion: '/doctor/medicamentos',
                        idReferencia: medicamento.idmedicamento
                    });
                }
            });
        }

        // Generar notificaciones de dispositivos
        if (this.dispositivosReales && this.dispositivosReales.length > 0) {
            const dispositivosActivos = this.dispositivosReales.filter(d =>
                d.activo === true || d.activo === 'true' || d.activo === 1
            );

            dispositivosActivos.forEach((dispositivo, index) => {
                const fecha = dispositivo.created_at || new Date().toISOString();
                const fechaFormateada = this.formatearFechaNotificacion(fecha);

                this.notificaciones.push({
                    id: 4000 + index,
                    tipo: 'dispositivo',
                    titulo: 'Dispositivo vinculado',
                    mensaje: `${dispositivo.nombre || 'Dispositivo'} - MAC: ${dispositivo.direccionmac || ''} (${fechaFormateada})`,
                    fecha: fecha,
                    leida: false,
                    icono: 'bi-device-hdd',
                    color: '#f59e0b',
                    accion: '/doctor/dispositivos',
                    idReferencia: dispositivo.iddispositivo
                });
            });
        }

        // Si no hay notificaciones, mostrar mensaje de bienvenida
        if (this.notificaciones.length === 0) {
            this.notificaciones.push({
                id: 1,
                tipo: 'sistema',
                titulo: 'Bienvenido a HTAS',
                mensaje: 'No tienes actividades registradas. Gestiona tus pacientes, citas y tratamientos desde el panel.',
                fecha: new Date().toISOString(),
                leida: false,
                icono: 'bi-info-circle-fill',
                color: '#3b82f6',
                accion: '/doctor/inicio'
            });
        }

        // Ordenar por fecha (más reciente primero)
        this.notificaciones.sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        this.guardarNotificaciones();
    }

    private formatearFechaNotificacion(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return fecha;

            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const anio = d.getFullYear();

            return `${dia}/${mes}/${anio}`;
        } catch {
            return fecha;
        }
    }

    private guardarNotificaciones() {
        try {
            localStorage.setItem('notificaciones_doctor_htas', JSON.stringify(this.notificaciones));
        } catch (e) {
            console.error('Error al guardar notificaciones:', e);
        }
    }

    private inicializarEventListeners() {
        const citaEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'cita',
                    titulo: data.titulo || 'Nueva cita',
                    mensaje: data.mensaje || 'Se ha agendado una nueva cita',
                    icono: 'bi-calendar-event',
                    color: '#b0001e',
                    accion: '/doctor/citas',
                    idReferencia: data.id
                });
            }
        };

        const pacienteEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'paciente',
                    titulo: data.titulo || 'Nuevo paciente',
                    mensaje: data.mensaje || 'Un nuevo paciente se ha registrado',
                    icono: 'bi-person-plus',
                    color: '#3b82f6',
                    accion: '/doctor/pacientes',
                    idReferencia: data.id
                });
            }
        };

        const tratamientoEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'tratamiento',
                    titulo: data.titulo || 'Tratamiento iniciado',
                    mensaje: data.mensaje || 'Se ha iniciado un nuevo tratamiento',
                    icono: 'bi-capsule',
                    color: '#10b981',
                    accion: '/doctor/tratamientos',
                    idReferencia: data.id
                });
            }
        };

        const medicamentoEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'medicamento',
                    titulo: data.titulo || 'Medicamento recetado',
                    mensaje: data.mensaje || 'Se ha recetado un medicamento',
                    icono: 'bi-capsule',
                    color: '#7c3aed',
                    accion: '/doctor/medicamentos',
                    idReferencia: data.id
                });
            }
        };

        const dispositivoEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'dispositivo',
                    titulo: data.titulo || 'Dispositivo vinculado',
                    mensaje: data.mensaje || 'Se ha vinculado un nuevo dispositivo',
                    icono: 'bi-device-hdd',
                    color: '#f59e0b',
                    accion: '/doctor/dispositivos',
                    idReferencia: data.id
                });
            }
        };

        document.addEventListener('nueva-cita-doctor', citaEvent as EventListener);
        document.addEventListener('nuevo-paciente', pacienteEvent as EventListener);
        document.addEventListener('tratamiento-doctor', tratamientoEvent as EventListener);
        document.addEventListener('medicamento-doctor', medicamentoEvent as EventListener);
        document.addEventListener('dispositivo-doctor', dispositivoEvent as EventListener);

        this.eventos = [
            { unsubscribe: () => document.removeEventListener('nueva-cita-doctor', citaEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('nuevo-paciente', pacienteEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('tratamiento-doctor', tratamientoEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('medicamento-doctor', medicamentoEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('dispositivo-doctor', dispositivoEvent as EventListener) }
        ];
    }

    agregarNotificacion(data: {
        tipo: 'cita' | 'tratamiento' | 'medicamento' | 'dispositivo' | 'paciente' | 'sistema';
        titulo: string;
        mensaje: string;
        icono: string;
        color: string;
        accion?: string;
        idReferencia?: number;
    }) {
        const nuevaNotificacion: Notificacion = {
            id: Date.now(),
            tipo: data.tipo,
            titulo: data.titulo,
            mensaje: data.mensaje,
            fecha: new Date().toISOString(),
            leida: false,
            icono: data.icono,
            color: data.color,
            accion: data.accion,
            idReferencia: data.idReferencia
        };

        this.notificaciones.unshift(nuevaNotificacion);
        this.guardarNotificaciones();
        this.calcularEstadisticas();
        this.aplicarFiltro(this.filterEstado);
        this.cdr.markForCheck();

        this.lanzarNotificacion('Nueva notificacion', data.titulo, 'success');
    }

    calcularEstadisticas() {
        this.estadisticas.total = this.notificaciones.length;
        this.estadisticas.noLeidas = this.notificaciones.filter(n => !n.leida).length;
        this.estadisticas.leidas = this.notificaciones.filter(n => n.leida).length;
        this.cdr.markForCheck();
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todas') {
            this.notificacionesFiltradas = [...this.notificaciones];
        } else if (estado === 'noLeidas') {
            this.notificacionesFiltradas = this.notificaciones.filter(n => !n.leida);
        } else if (estado === 'leidas') {
            this.notificacionesFiltradas = this.notificaciones.filter(n => n.leida);
        } else {
            this.notificacionesFiltradas = this.notificaciones.filter(n => n.tipo === estado);
        }
        this.cdr.markForCheck();
    }

    marcarComoLeida(notificacion: Notificacion) {
        const found = this.notificaciones.find(n => n.id === notificacion.id);
        if (found) {
            found.leida = true;
            this.guardarNotificaciones();
            this.calcularEstadisticas();
            this.aplicarFiltro(this.filterEstado);
            this.cdr.markForCheck();
        }
    }

    marcarTodasComoLeidas() {
        this.notificaciones.forEach(n => n.leida = true);
        this.guardarNotificaciones();
        this.calcularEstadisticas();
        this.aplicarFiltro(this.filterEstado);
        this.lanzarNotificacion('Exito', 'Todas las notificaciones marcadas como leidas', 'success');
        this.cdr.markForCheck();
    }

    verDetalle(notificacion: Notificacion) {
        this.notificacionSeleccionada = notificacion;
        if (!notificacion.leida) {
            this.marcarComoLeida(notificacion);
        }
        this.mostrarModalDetalle = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    cerrarModalDetalle() {
        this.mostrarModalDetalle = false;
        this.notificacionSeleccionada = null;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    irAAccion(notificacion: Notificacion) {
        if (notificacion.accion) {
            this.router.navigate([notificacion.accion]);
            this.cerrarModalDetalle();
        }
    }

    abrirModalEliminar(notificacion: Notificacion) {
        this.notificacionParaEliminar = notificacion;
        this.modalConfirmacion = {
            titulo: 'Eliminar Notificacion',
            mensaje: '¿Estas seguro de que deseas eliminar esta notificacion?',
            icono: 'bi-exclamation-triangle-fill',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        this.notificacionParaEliminar = null;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    confirmarEliminar() {
        if (this.notificacionParaEliminar) {
            const index = this.notificaciones.findIndex(n => n.id === this.notificacionParaEliminar!.id);
            if (index !== -1) {
                this.notificaciones.splice(index, 1);
                this.guardarNotificaciones();
                this.calcularEstadisticas();
                this.aplicarFiltro(this.filterEstado);
                this.lanzarNotificacion('Exito', 'Notificacion eliminada', 'success');
                this.cdr.markForCheck();
            }
        }
        this.cerrarModalConfirmacion();
    }

    eliminarTodasLeidas() {
        const leidas = this.notificaciones.filter(n => n.leida);
        if (leidas.length === 0) {
            this.lanzarNotificacion('Info', 'No hay notificaciones leidas para eliminar', 'warning');
            return;
        }

        this.modalConfirmacion = {
            titulo: 'Eliminar Notificaciones Leidas',
            mensaje: `¿Estas seguro de que deseas eliminar las ${leidas.length} notificaciones leidas?`,
            icono: 'bi-exclamation-triangle-fill',
            accion: 'eliminar-todas'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    confirmarEliminarTodasLeidas() {
        this.notificaciones = this.notificaciones.filter(n => !n.leida);
        this.guardarNotificaciones();
        this.calcularEstadisticas();
        this.aplicarFiltro(this.filterEstado);
        this.lanzarNotificacion('Exito', 'Notificaciones leidas eliminadas', 'success');
        this.cerrarModalConfirmacion();
        this.cdr.markForCheck();
    }

    lanzarNotificacion(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
        this.mensajeToast = `${titulo}: ${mensaje}`;
        this.tipoToast = tipo;
        this.mostrarToast = true;
        this.cdr.markForCheck();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.mostrarToast = false;
            this.cdr.markForCheck();
        }, 4000);
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return fecha;

            const ahora = new Date();
            const diff = ahora.getTime() - d.getTime();
            const minutos = Math.floor(diff / 60000);
            const horas = Math.floor(diff / 3600000);
            const dias = Math.floor(diff / 86400000);

            if (minutos < 1) return 'Hace un momento';
            if (minutos < 60) return `Hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
            if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
            if (dias < 7) return `Hace ${dias} dia${dias !== 1 ? 's' : ''}`;

            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const anio = d.getFullYear();
            return `${dia}/${mes}/${anio}`;
        } catch {
            return fecha;
        }
    }

    getTipoTexto(tipo: string): string {
        const tipos: { [key: string]: string } = {
            'cita': 'Cita',
            'tratamiento': 'Tratamiento',
            'medicamento': 'Medicamento',
            'dispositivo': 'Dispositivo',
            'paciente': 'Paciente',
            'sistema': 'Sistema'
        };
        return tipos[tipo] || tipo;
    }
}