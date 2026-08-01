import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CaregiverMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface Notificacion {
    id: number;
    tipo: 'cita' | 'tratamiento' | 'medicamento' | 'dispositivo' | 'paciente' | 'sistema' | 'solicitud';
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
    selector: 'app-caregiver-notificaciones',
    standalone: true,
    imports: [CommonModule, FormsModule, CaregiverMenu],
    templateUrl: './notificaciones.html',
    styleUrls: ['./notificaciones.css']
})
export class CaregiverNotificaciones implements OnInit {
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

    caregiverId: number | null = null;
    caregiverName: string = '';
    userEmail: string = '';

    pacientesAsignados: any[] = [];
    private solicitudesReales: any[] = [];
    private tratamientosReales: any[] = [];
    private citasReales: any[] = [];
    private medicamentosReales: any[] = [];
    private dispositivosReales: any[] = [];

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.userEmail = userData.correo || '';
                    this.caregiverName = userData.nombre || 'Acompanante';
                    this.caregiverId = userData.idusuario || userData.uid || null;
                } catch (e) {
                    console.error('Error al parsear userData:', e);
                }
            }

            if (!this.userEmail) {
                const user = this.auth.currentUser;
                if (user) {
                    this.userEmail = user.email || '';
                    this.caregiverName = user.displayName || 'Acompanante';
                }
            }

            if (this.caregiverId) {
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
            const pacientes = await firstValueFrom(
                this.usersService.getPacientesAsignados(this.caregiverId!)
            );
            if (Array.isArray(pacientes) && pacientes.length > 0) {
                this.pacientesAsignados = pacientes;
            }

            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId!)
            );
            if (Array.isArray(solicitudes) && solicitudes.length > 0) {
                this.solicitudesReales = solicitudes;
            }

            const tratamientos = await firstValueFrom(
                this.usersService.getTratamientos()
            );
            if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                this.tratamientosReales = tratamientos;
            }

            const citas = await firstValueFrom(
                this.usersService.getAllCitas()
            );

            if (Array.isArray(citas) && citas.length > 0) {
                const pacientesMap = new Map<string, number>();
                const pacientesMapCorreo = new Map<string, number>();

                this.pacientesAsignados.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (!id) return;

                    const nombreCompleto = `${p.nombre || ''} ${p.apPaterno || ''} ${p.apMaterno || ''}`.trim().toLowerCase();
                    if (nombreCompleto) {
                        pacientesMap.set(nombreCompleto, id);
                    }

                    if (p.nombre) {
                        pacientesMap.set(p.nombre.toLowerCase(), id);
                    }

                    if (p.correo) {
                        pacientesMapCorreo.set(p.correo.toLowerCase(), id);
                    }
                });

                this.citasReales = citas.map(c => {
                    const nombrePaciente = c.nombrepaciente || c.NombrePaciente || c.nombrePaciente || '';
                    const apPaterno = c.appaternopaciente || c.ApPaternoPaciente || c.apPaternoPaciente || '';
                    const apMaterno = c.apmaternopaciente || c.ApMaternoPaciente || c.apMaternoPaciente || '';
                    const nombreCompleto = `${nombrePaciente} ${apPaterno} ${apMaterno}`.trim().toLowerCase();

                    let idPaciente = pacientesMap.get(nombreCompleto);

                    if (!idPaciente && nombrePaciente) {
                        idPaciente = pacientesMap.get(nombrePaciente.toLowerCase());
                    }

                    if (!idPaciente) {
                        const correoPaciente = c.correopaciente || c.CorreoPaciente || '';
                        if (correoPaciente) {
                            idPaciente = pacientesMapCorreo.get(correoPaciente.toLowerCase());
                            if (!idPaciente) {
                                const pacienteEncontrado = this.pacientesAsignados.find(p =>
                                    p.correo?.toLowerCase() === correoPaciente.toLowerCase()
                                );
                                if (pacienteEncontrado) {
                                    idPaciente = pacienteEncontrado.idusuario || pacienteEncontrado.id;
                                }
                            }
                        }
                    }

                    return {
                        ...c,
                        idpaciente: idPaciente
                    };
                });
            } else {
                this.citasReales = [];
            }

            const medicamentos = await firstValueFrom(
                this.usersService.getMedicamentos()
            );
            if (Array.isArray(medicamentos) && medicamentos.length > 0) {
                this.medicamentosReales = medicamentos;
            }

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

        const pacientesSet = new Set<number>();
        this.pacientesAsignados.forEach(p => {
            const id = p.idusuario || p.id || p.IdUsuario;
            if (id) {
                pacientesSet.add(id);
            }
        });

        if (this.solicitudesReales && this.solicitudesReales.length > 0) {
            this.solicitudesReales.forEach((solicitud, index) => {
                const estado = solicitud.estado || 'pendiente';
                let titulo = '';
                let mensaje = '';
                let icono = 'bi-clock-history';
                let color = '#f59e0b';

                if (estado === 'pendiente') {
                    titulo = 'Solicitud de acceso pendiente';
                    mensaje = `Solicitud para paciente ${solicitud.nombrepaciente || 'paciente'} esperando aprobacion`;
                    icono = 'bi-clock-history';
                    color = '#f59e0b';
                } else if (estado === 'aprobada') {
                    titulo = 'Solicitud de acceso aprobada';
                    mensaje = `Has sido autorizado para dar seguimiento a ${solicitud.nombrepaciente || 'paciente'}`;
                    icono = 'bi-check-circle-fill';
                    color = '#10b981';
                } else if (estado === 'rechazada') {
                    titulo = 'Solicitud de acceso rechazada';
                    mensaje = `Tu solicitud para ${solicitud.nombrepaciente || 'paciente'} fue rechazada`;
                    icono = 'bi-x-circle-fill';
                    color = '#ef4444';
                }

                const fecha = solicitud.created_at || new Date().toISOString();

                this.notificaciones.push({
                    id: 6000 + index,
                    tipo: 'solicitud',
                    titulo: titulo,
                    mensaje: mensaje,
                    fecha: fecha,
                    leida: false,
                    icono: icono,
                    color: color,
                    accion: '/caregiver/pacientes',
                    idReferencia: solicitud.idsolicitud
                });
            });
        }

        if (this.pacientesAsignados && this.pacientesAsignados.length > 0) {
            this.pacientesAsignados.forEach((paciente, index) => {
                const nombreCompleto = `${paciente.nombre || ''} ${paciente.apPaterno || ''} ${paciente.apMaterno || ''}`.trim();
                const fecha = paciente.created_at || new Date().toISOString();

                this.notificaciones.push({
                    id: 5000 + index,
                    tipo: 'paciente',
                    titulo: 'Paciente asignado',
                    mensaje: `${nombreCompleto || 'Paciente'} ha sido asignado a tu cuidado`,
                    fecha: fecha,
                    leida: false,
                    icono: 'bi-person-check',
                    color: '#3b82f6',
                    accion: '/caregiver/pacientes',
                    idReferencia: paciente.idusuario
                });
            });
        }

        if (this.citasReales && this.citasReales.length > 0) {
            const citasFiltradas = this.citasReales.filter(c => {
                const idPaciente = c.idpaciente ||
                    c.IdPaciente ||
                    c.idPaciente ||
                    c.pacienteId ||
                    c.idusuario;

                return idPaciente && pacientesSet.has(idPaciente);
            });

            citasFiltradas.forEach((cita, index) => {
                const fechaCita = cita.fechacita || cita.FechaCita || cita.fecha || cita.Fecha || '';
                const fechaFormateada = this.formatearFechaNotificacion(fechaCita);

                let horaCita = cita.horacita || cita.HoraCita || cita.hora || cita.Hora || '';
                if (horaCita && horaCita.includes(':')) {
                    const partes = horaCita.split(':');
                    horaCita = partes[0] + ':' + partes[1];
                }

                const nombrePaciente = cita.nombrepaciente || cita.NombrePaciente || cita.nombrePaciente || '';
                const apPaterno = cita.appaternopaciente || cita.ApPaternoPaciente || cita.apPaternoPaciente || '';
                const apMaterno = cita.apmaternopaciente || cita.ApMaternoPaciente || cita.apMaternoPaciente || '';
                let pacienteCompleto = `${nombrePaciente} ${apPaterno} ${apMaterno}`.trim();
                if (!pacienteCompleto || pacienteCompleto === '') {
                    pacienteCompleto = cita.paciente || cita.Paciente || 'Paciente';
                }

                const estadoCita = cita.estado || cita.Estado || 'Pendiente';
                let titulo = 'Cita programada';
                let icono = 'bi-calendar-event';
                let color = '#b0001e';
                let mensaje = `${pacienteCompleto} tiene cita el ${fechaFormateada} a las ${horaCita || '00:00'}`;

                const estadoLower = estadoCita.toLowerCase();
                if (estadoLower === 'cancelada') {
                    titulo = 'Cita cancelada';
                    icono = 'bi-calendar-x';
                    color = '#ef4444';
                    mensaje = `La cita de ${pacienteCompleto} ha sido cancelada`;
                } else if (estadoLower === 'completada' || estadoLower === 'realizada' || estadoLower === 'finalizada') {
                    titulo = 'Cita completada';
                    icono = 'bi-calendar-check';
                    color = '#10b981';
                    mensaje = `La cita de ${pacienteCompleto} ha sido completada`;
                }

                this.notificaciones.push({
                    id: 1000 + index,
                    tipo: 'cita',
                    titulo: titulo,
                    mensaje: mensaje,
                    fecha: cita.created_at || cita.CreatedAt || cita.createdAt || new Date().toISOString(),
                    leida: false,
                    icono: icono,
                    color: color,
                    accion: '/caregiver/citas',
                    idReferencia: cita.idcita || cita.IdCita || cita.id || cita.idCita
                });
            });
        }

        if (this.tratamientosReales && this.tratamientosReales.length > 0) {
            const tratamientosFiltrados = this.tratamientosReales.filter(t => {
                const idPaciente = t.idpaciente || t.IdPaciente || t.idPaciente;
                return idPaciente && pacientesSet.has(idPaciente);
            });

            tratamientosFiltrados.forEach((tratamiento, index) => {
                const medicamento = tratamiento.nombremedicamento || 'Medicamento';
                const fecha = tratamiento.created_at || new Date().toISOString();

                this.notificaciones.push({
                    id: 2000 + index,
                    tipo: 'tratamiento',
                    titulo: 'Tratamiento activo',
                    mensaje: `Tratamiento con ${medicamento} - ${tratamiento.dosis || ''}`,
                    fecha: fecha,
                    leida: false,
                    icono: 'bi-capsule',
                    color: '#10b981',
                    accion: '/caregiver/tratamientos',
                    idReferencia: tratamiento.idtratamiento
                });
            });
        }

        if (this.medicamentosReales && this.medicamentosReales.length > 0) {
            this.medicamentosReales.forEach((medicamento, index) => {
                if (medicamento.totaltratamientos > 0) {
                    const fecha = medicamento.created_at || new Date().toISOString();

                    this.notificaciones.push({
                        id: 3000 + index,
                        tipo: 'medicamento',
                        titulo: 'Medicamento disponible',
                        mensaje: `${medicamento.nombrecomercial || 'Medicamento'} - ${medicamento.presentacion || ''}`,
                        fecha: fecha,
                        leida: false,
                        icono: 'bi-capsule',
                        color: '#7c3aed',
                        accion: '/caregiver/medicamentos',
                        idReferencia: medicamento.idmedicamento
                    });
                }
            });
        }

        if (this.dispositivosReales && this.dispositivosReales.length > 0) {
            const dispositivosFiltrados = this.dispositivosReales.filter(d => {
                const idPaciente = d.idpacienteasociado || d.idPacienteAsociado;
                return idPaciente && pacientesSet.has(idPaciente);
            });

            dispositivosFiltrados.forEach((dispositivo, index) => {
                const fecha = dispositivo.created_at || new Date().toISOString();

                this.notificaciones.push({
                    id: 4000 + index,
                    tipo: 'dispositivo',
                    titulo: 'Dispositivo vinculado',
                    mensaje: `${dispositivo.nombre || 'Dispositivo'} - MAC: ${dispositivo.direccionmac || ''}`,
                    fecha: fecha,
                    leida: false,
                    icono: 'bi-device-hdd',
                    color: '#f59e0b',
                    accion: '/caregiver/dispositivos',
                    idReferencia: dispositivo.iddispositivo
                });
            });
        }

        if (this.notificaciones.length === 0) {
            this.notificaciones.push({
                id: 1,
                tipo: 'sistema',
                titulo: 'Bienvenido a HTAS',
                mensaje: 'No tienes actividades registradas. Gestiona tus pacientes y tratamientos desde el panel.',
                fecha: new Date().toISOString(),
                leida: false,
                icono: 'bi-info-circle-fill',
                color: '#3b82f6',
                accion: '/caregiver/inicio'
            });
        }

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
            localStorage.setItem('notificaciones_caregiver_htas', JSON.stringify(this.notificaciones));
        } catch (e) {
            console.error('Error al guardar notificaciones:', e);
        }
    }

    private inicializarEventListeners() {
        const pacienteEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'paciente',
                    titulo: data.titulo || 'Nuevo paciente asignado',
                    mensaje: data.mensaje || 'Un nuevo paciente ha sido asignado a tu cuidado',
                    icono: 'bi-person-check',
                    color: '#3b82f6',
                    accion: '/caregiver/pacientes',
                    idReferencia: data.id
                });
            }
        };

        const citaEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'cita',
                    titulo: data.titulo || 'Nueva cita',
                    mensaje: data.mensaje || 'Se ha programado una nueva cita para tu paciente',
                    icono: 'bi-calendar-event',
                    color: '#b0001e',
                    accion: '/caregiver/citas',
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
                    mensaje: data.mensaje || 'Se ha iniciado un nuevo tratamiento para tu paciente',
                    icono: 'bi-capsule',
                    color: '#10b981',
                    accion: '/caregiver/tratamientos',
                    idReferencia: data.id
                });
            }
        };

        const solicitudEvent = (event: CustomEvent) => {
            const data = event.detail;
            if (data) {
                this.agregarNotificacion({
                    tipo: 'solicitud',
                    titulo: data.titulo || 'Solicitud actualizada',
                    mensaje: data.mensaje || 'El estado de tu solicitud ha sido actualizado',
                    icono: 'bi-clock-history',
                    color: '#f59e0b',
                    accion: '/caregiver/pacientes',
                    idReferencia: data.id
                });
            }
        };

        document.addEventListener('nuevo-paciente-asignado', pacienteEvent as EventListener);
        document.addEventListener('cita-paciente', citaEvent as EventListener);
        document.addEventListener('tratamiento-paciente', tratamientoEvent as EventListener);
        document.addEventListener('solicitud-actualizada', solicitudEvent as EventListener);

        this.eventos = [
            { unsubscribe: () => document.removeEventListener('nuevo-paciente-asignado', pacienteEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('cita-paciente', citaEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('tratamiento-paciente', tratamientoEvent as EventListener) },
            { unsubscribe: () => document.removeEventListener('solicitud-actualizada', solicitudEvent as EventListener) }
        ];
    }

    agregarNotificacion(data: {
        tipo: 'cita' | 'tratamiento' | 'medicamento' | 'dispositivo' | 'paciente' | 'sistema' | 'solicitud';
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
            'sistema': 'Sistema',
            'solicitud': 'Solicitud'
        };
        return tipos[tipo] || tipo;
    }
}