import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PatientMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface Notificacion {
    id: number;
    tipo: 'cita' | 'tratamiento' | 'medicamento' | 'dispositivo' | 'sistema';
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
    selector: 'app-patient-notificaciones',
    standalone: true,
    imports: [CommonModule, FormsModule, PatientMenu],
    templateUrl: './notificaciones.html',
    styleUrls: ['./notificaciones.css']
})
export class PatientNotificaciones implements OnInit {
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

    patientId: number | null = null;
    patientName: string = '';
    userEmail: string = '';

    // Datos reales
    citasReales: any[] = [];
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
                    this.patientName = userData.nombre || 'Paciente';
                    this.patientId = userData.idusuario || userData.uid || null;
                } catch (e) {
                    console.error('Error al parsear userData:', e);
                }
            }

            if (!this.userEmail) {
                const user = this.auth.currentUser;
                if (user) {
                    this.userEmail = user.email || '';
                    this.patientName = user.displayName || 'Paciente';
                }
            }

            if (this.patientId) {
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
            if (this.userEmail) {
                const citas = await firstValueFrom(
                    this.usersService.getMisCitas(this.userEmail)
                );
                if (Array.isArray(citas) && citas.length > 0) {
                    this.citasReales = citas;
                }
            }

            if (this.patientId) {
                const tratamientos = await firstValueFrom(
                    this.usersService.getTratamientosByPaciente(this.patientId)
                );
                if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                    this.tratamientosReales = tratamientos;
                }

                const dispositivos = await firstValueFrom(
                    this.usersService.getDispositivosByPaciente(this.patientId)
                );
                if (Array.isArray(dispositivos) && dispositivos.length > 0) {
                    this.dispositivosReales = dispositivos;
                }
            }

            const medicamentos = await firstValueFrom(
                this.usersService.getMedicamentos()
            );
            if (Array.isArray(medicamentos) && medicamentos.length > 0) {
                this.medicamentosReales = medicamentos;
            }

        } catch (error) {
            console.error('Error al cargar datos reales:', error);
        }
    }

    private async generarNotificacionesDesdeDatos() {
        this.notificaciones = [];

        // ✅ Generar notificaciones de citas
        if (this.citasReales && this.citasReales.length > 0) {
            const citasActivas = this.citasReales.filter(c =>
                c.estado !== 'Cancelada' && c.estado !== 'Completada'
            );

            citasActivas.forEach((cita, index) => {
                // ✅ Formatear fecha correctamente
                const fechaCita = cita.fechacita || cita.fecha || '';
                const fechaFormateada = this.formatearFechaNotificacion(fechaCita);

                // ✅ Formatear hora sin segundos
                let horaCita = cita.horacita || cita.hora || '';
                if (horaCita.includes(':')) {
                    const partes = horaCita.split(':');
                    horaCita = partes[0] + ':' + partes[1];
                }

                this.notificaciones.push({
                    id: 1000 + index,
                    tipo: 'cita',
                    titulo: 'Cita programada',
                    mensaje: `Cita el ${fechaFormateada} a las ${horaCita} - ${cita.motivo || 'Consulta medica'}`,
                    fecha: cita.created_at || new Date().toISOString(),
                    leida: false,
                    icono: 'bi-calendar-event',
                    color: '#b0001e',
                    accion: '/patient/citas',
                    idReferencia: cita.idcita || cita.id
                });
            });
        }

        // ✅ Generar notificaciones de tratamientos
        if (this.tratamientosReales && this.tratamientosReales.length > 0) {
            const tratamientosActivos = this.tratamientosReales.filter(t =>
                t.activo === true || t.activo === 'true' || t.activo === 1
            );

            tratamientosActivos.forEach((tratamiento, index) => {
                const medicamento = tratamiento.nombremedicamento || 'Medicamento';
                const fechaInicio = tratamiento.fechainicio || new Date().toISOString();
                const fechaFormateada = this.formatearFechaNotificacion(fechaInicio);

                this.notificaciones.push({
                    id: 2000 + index,
                    tipo: 'tratamiento',
                    titulo: 'Tratamiento activo',
                    mensaje: `Tratamiento con ${medicamento} - ${tratamiento.dosis || ''} (Inicio: ${fechaFormateada})`,
                    fecha: fechaInicio,
                    leida: false,
                    icono: 'bi-capsule',
                    color: '#10b981',
                    accion: '/patient/tratamientos',
                    idReferencia: tratamiento.idtratamiento
                });
            });
        }

        // ✅ Generar notificaciones de medicamentos
        if (this.medicamentosReales && this.medicamentosReales.length > 0) {
            this.medicamentosReales.forEach((medicamento, index) => {
                if (medicamento.totaltratamientos > 0) {
                    const fecha = medicamento.created_at || new Date().toISOString();
                    const fechaFormateada = this.formatearFechaNotificacion(fecha);

                    this.notificaciones.push({
                        id: 3000 + index,
                        tipo: 'medicamento',
                        titulo: 'Medicamento recetado',
                        mensaje: `${medicamento.nombrecomercial || 'Medicamento'} - ${medicamento.presentacion || ''} (${fechaFormateada})`,
                        fecha: fecha,
                        leida: false,
                        icono: 'bi-capsule',
                        color: '#7c3aed',
                        accion: '/patient/medicamentos',
                        idReferencia: medicamento.idmedicamento
                    });
                }
            });
        }

        // ✅ Generar notificaciones de dispositivos
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
                    accion: '/patient/dispositivos',
                    idReferencia: dispositivo.iddispositivo
                });
            });
        }

        // ✅ Si no hay notificaciones, mostrar mensaje de bienvenida
        if (this.notificaciones.length === 0) {
            this.notificaciones.push({
                id: 1,
                tipo: 'sistema',
                titulo: 'Bienvenido a HTAS',
                mensaje: 'No tienes actividades registradas. Comienza agendando una cita o vinculando un dispositivo.',
                fecha: new Date().toISOString(),
                leida: false,
                icono: 'bi-info-circle-fill',
                color: '#3b82f6'
            });
        }

        // ✅ Ordenar por fecha (más reciente primero)
        this.notificaciones.sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        this.guardarNotificaciones();
    }

    // ✅ NUEVO MÉTODO: Formatear fecha para notificaciones
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
            localStorage.setItem('notificaciones_htas', JSON.stringify(this.notificaciones));
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
                    mensaje: data.mensaje || 'Se ha registrado una nueva cita',
                    icono: 'bi-calendar-event',
                    color: '#b0001e',
                    accion: '/patient/citas',
                    idReferencia: data.id
                });
            }
        };

        const tratamientoEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'tratamiento',
                    titulo: data.titulo || 'Tratamiento actualizado',
                    mensaje: data.mensaje || 'Se ha actualizado un tratamiento',
                    icono: 'bi-capsule',
                    color: '#10b981',
                    accion: '/patient/tratamientos',
                    idReferencia: data.id
                });
            }
        };

        const medicamentoEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'medicamento',
                    titulo: data.titulo || 'Nuevo medicamento',
                    mensaje: data.mensaje || 'Se ha recetado un nuevo medicamento',
                    icono: 'bi-capsule',
                    color: '#7c3aed',
                    accion: '/patient/medicamentos',
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
                    accion: '/patient/dispositivos',
                    idReferencia: data.id
                });
            }
        };

        document.addEventListener('nueva-cita', citaEvent as EventListener);
        document.addEventListener('tratamiento-actualizado', tratamientoEvent as EventListener);
        document.addEventListener('medicamento-agregado', medicamentoEvent as EventListener);
        document.addEventListener('dispositivo-vinculado', dispositivoEvent as EventListener);

        this.eventos = [
            { unsubscribe: () => document.removeEventListener('nueva-cita', citaEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('tratamiento-actualizado', tratamientoEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('medicamento-agregado', medicamentoEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('dispositivo-vinculado', dispositivoEvent as EventListener) }
        ];
    }

    agregarNotificacion(data: {
        tipo: 'cita' | 'tratamiento' | 'medicamento' | 'dispositivo' | 'sistema';
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

    // ==========================================
    // METODOS PUBLICOS
    // ==========================================

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

    // ==========================================
    // NOTIFICACIONES TOAST
    // ==========================================

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

    // ==========================================
    // METODOS DE UTILIDAD
    // ==========================================

    // ✅ MÉTODO PRINCIPAL PARA FORMATEAR FECHA EN EL TEMPLATE
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
            'sistema': 'Sistema'
        };
        return tipos[tipo] || tipo;
    }
}