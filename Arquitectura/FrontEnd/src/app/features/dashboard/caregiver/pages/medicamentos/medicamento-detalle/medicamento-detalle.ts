import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-caregiver-medicamento-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, CaregiverMenu],
    templateUrl: './medicamento-detalle.html',
    styleUrls: ['./medicamento-detalle.css']
})
export class CaregiverMedicamentoDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    medicamentoId: number | null = null;
    medicamento: any = null;
    caregiverId: number | null = null;
    tieneAcceso: boolean = false;
    solicitudEnviada: boolean = false;

    estadisticas: any = null;
    cargandoEstadisticas = false;

    tratamientosRelacionados: any[] = [];
    mostrandoTratamientos = false;

    // Mapa de pacientes para obtener nombres
    private pacientesMap: Map<number, any> = new Map();

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    mostrarModalSolicitud: boolean = false;
    pacienteSolicitado: any = null;
    parentesco: string = '';
    notasSolicitud: string = '';
    enviandoSolicitud: boolean = false;

    parentescos = [
        'Padre', 'Madre', 'Hermano', 'Hermana', 'Tio', 'Tia',
        'Primo', 'Prima', 'Abuelo', 'Abuela', 'Conyuge', 'Otro'
    ];

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        const storedUser = localStorage.getItem('user_htas');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            this.caregiverId = userData.idusuario || userData.uid || null;
        }

        this.route.params.subscribe(params => {
            this.medicamentoId = +params['id'];
            if (this.medicamentoId) {
                this.cargarDatosIniciales();
            }
        });
    }

    private showToast(type: ToastNotification['type'], title: string, message: string, duration: number = 5000) {
        const id = ++this.notificationCounter;
        const notification: ToastNotification = {
            id,
            type,
            title,
            message,
            duration
        };

        this.notifications.unshift(notification);
        this.cdr.detectChanges();

        setTimeout(() => {
            this.removeToast(id);
        }, duration);
    }

    removeToast(id: number) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.cdr.detectChanges();
    }

    showSuccess(title: string, message: string, duration: number = 5000) {
        this.showToast('success', title, message, duration);
    }

    showError(title: string, message: string, duration: number = 7000) {
        this.showToast('error', title, message, duration);
    }

    showWarning(title: string, message: string, duration: number = 5000) {
        this.showToast('warning', title, message, duration);
    }

    showInfo(title: string, message: string, duration: number = 4000) {
        this.showToast('info', title, message, duration);
    }

    async cargarDatosIniciales() {
        this.isLoading = true;
        try {
            // Primero cargar pacientes para tener el mapa
            await this.cargarPacientes();
            // Luego cargar el medicamento
            if (this.medicamentoId) {
                await this.cargarMedicamento(this.medicamentoId);
            }
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            this.showError('Error', 'No se pudieron cargar los datos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarPacientes() {
        try {
            const usuarios = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(usuarios)) {
                const pacientes = usuarios.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );

                this.pacientesMap.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesMap.set(id, p);
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
        }
    }

    async cargarMedicamento(id: number) {
        try {
            const data = await firstValueFrom(this.usersService.getMedicamentoById(id));

            this.medicamento = {
                ...data,
                idmedicamento: data.idmedicamento || data.IdMedicamento || data.id,
                nombreComercial: data.nombrecomercial || data.NombreComercial || 'Medicamento',
                sustanciaActiva: data.sustanciaactiva || data.SustanciaActiva,
                presentacion: data.presentacion || data.Presentacion,
                concentracion: data.concentracion || data.Concentracion,
                laboratorio: data.laboratorio || data.Laboratorio,
                indicacionesGenerales: data.indicacionesgenerales || data.IndicacionesGenerales,
                totalTratamientos: data.totaltratamientos || data.TotalTratamientos || 0,
                tratamientosActivos: data.tratamientosactivos || data.TratamientosActivos || 0
            };

            await this.cargarTratamientosRelacionados(id);

        } catch (error) {
            console.error('Error al cargar medicamento:', error);
            this.showError('Error', 'No se pudo cargar la informacion del medicamento.');
        }
    }

    async cargarTratamientosRelacionados(idMedicamento: number) {
        try {
            const tratamientos = await firstValueFrom(this.usersService.getTratamientos());

            if (Array.isArray(tratamientos)) {
                const pacientesAsignados = await firstValueFrom(
                    this.usersService.getPacientesAsignados(this.caregiverId!)
                );

                const pacientesSet = new Set<number>();
                if (Array.isArray(pacientesAsignados)) {
                    pacientesAsignados.forEach(p => {
                        const id = p.idusuario || p.id;
                        if (id) pacientesSet.add(id);
                    });
                }

                const filtrados = tratamientos.filter(t => {
                    const idMed = t.idmedicamento || t.IdMedicamento;
                    const idPaciente = t.idpaciente || t.IdPaciente || t.idPaciente;
                    return idMed === idMedicamento && pacientesSet.has(idPaciente);
                });

                this.tratamientosRelacionados = filtrados.map(t => {
                    const idPaciente = t.idpaciente || t.IdPaciente || t.idPaciente;
                    let nombrePaciente = 'Paciente sin nombre';

                    // OBTENER NOMBRE DEL PACIENTE DESDE EL MAPA
                    if (idPaciente && this.pacientesMap.has(idPaciente)) {
                        const pacienteData = this.pacientesMap.get(idPaciente);
                        const nombre = pacienteData.nombre || '';
                        const apPaterno = pacienteData.apPaterno || '';
                        const apMaterno = pacienteData.apMaterno || '';
                        nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        if (!nombrePaciente) {
                            nombrePaciente = pacienteData.correo || 'Paciente sin nombre';
                        }
                    }

                    return {
                        ...t,
                        idtratamiento: t.idtratamiento || t.IdTratamiento || t.id,
                        idpaciente: idPaciente,
                        paciente: nombrePaciente,
                        nombrePaciente: nombrePaciente,
                        fechainicio: t.FechaInicio || t.fechainicio || t.fechaInicio,
                        fechafin: t.FechaFin || t.fechafin || t.fechaFin,
                        activo: t.Activo !== undefined ? t.Activo : t.activo
                    };
                });

                this.mostrandoTratamientos = this.tratamientosRelacionados.length > 0;
                this.tieneAcceso = this.tratamientosRelacionados.length > 0;

                if (!this.tieneAcceso) {
                    await this.verificarSolicitudesPendientes();
                }
            }
        } catch (error) {
            console.error('Error al cargar tratamientos relacionados:', error);
            this.tratamientosRelacionados = [];
            this.mostrandoTratamientos = false;
        }
    }

    private async verificarSolicitudesPendientes() {
        try {
            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId!)
            );

            if (Array.isArray(solicitudes)) {
                const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
                const pacientesPendientes = new Set(pendientes.map(s => s.idpaciente));

                this.tratamientosRelacionados.forEach(t => {
                    if (pacientesPendientes.has(t.idpaciente)) {
                        this.solicitudEnviada = true;
                    }
                });
            }
        } catch (error) {
            console.error('Error al verificar solicitudes pendientes:', error);
        }
    }

    abrirModalSolicitud(tratamiento: any) {
        this.pacienteSolicitado = tratamiento;
        this.parentesco = '';
        this.notasSolicitud = '';
        this.mostrarModalSolicitud = true;
        this.cdr.detectChanges();
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.pacienteSolicitado = null;
        this.parentesco = '';
        this.notasSolicitud = '';
        this.enviandoSolicitud = false;
    }

    async enviarSolicitud() {
        if (!this.parentesco) {
            this.showWarning('Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            const paciente = this.pacienteSolicitado;
            const correoPaciente = paciente.correo || '';

            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: correoPaciente,
                    parentesco: this.parentesco,
                    notas: this.notasSolicitud
                })
            );

            this.showSuccess('Solicitud enviada',
                'Tu solicitud ha sido enviada. Espera la aprobacion del administrador.');

            this.solicitudEnviada = true;
            this.cerrarModalSolicitud();

        } catch (error: any) {
            const mensaje = error.error?.error || 'Error al enviar la solicitud';
            this.showError('Error', mensaje);
        } finally {
            this.enviandoSolicitud = false;
        }
    }

    volver() {
        this.router.navigate(['/caregiver/medicamentos']);
    }

    verTratamiento(id: number) {
        if (id) {
            this.router.navigate(['/caregiver/tratamientos/detalle', id]);
        }
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return 'Sin fecha';
            return d.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return 'Sin fecha';
        }
    }

    getEstadoClass(activo: boolean | undefined): string {
        if (activo === undefined) return 'badge-secondary';
        return activo ? 'badge-success' : 'badge-danger';
    }

    getEstadoTexto(activo: boolean | undefined): string {
        if (activo === undefined) return 'Desconocido';
        return activo ? 'Activo' : 'Inactivo';
    }

    getUsoClass(total: number): string {
        if (total === 0) return 'badge-secondary';
        return 'badge-success';
    }

    getUsoTexto(total: number): string {
        if (total === 0) return 'Sin uso';
        return `${total} tratamiento${total !== 1 ? 's' : ''}`;
    }
}