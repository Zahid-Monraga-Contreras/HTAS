import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

interface RegistroToma {
    id: number;
    idTratamiento: number;
    fechaProgramada: string;
    fechaRealizada?: string;
    estado: 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada' | 'Eliminada';
    notas?: string;
    idAcompanante?: number;
    nombreAcompanante?: string;
    fechaFormateada?: string;
    horaFormateada?: string;
}

@Component({
    selector: 'app-caregiver-tratamiento-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, CaregiverMenu],
    templateUrl: './tratamiento-detalle.html',
    styleUrls: ['./tratamiento-detalle.css']
})
export class CaregiverTratamientoDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    tratamientoId: number | null = null;
    tratamiento: any = null;
    caregiverId: number | null = null;
    tieneAcceso: boolean = false;
    solicitudEnviada: boolean = false;

    registrosTomas: RegistroToma[] = [];
    estadisticasTomas: any = null;
    cargandoTomas = false;
    filtroFecha: string = '';

    mostrarModalSolicitud: boolean = false;
    parentesco: string = '';
    notas: string = '';
    enviandoSolicitud: boolean = false;

    parentescos = [
        'Padre', 'Madre', 'Hermano', 'Hermana', 'Tio', 'Tia',
        'Primo', 'Prima', 'Abuelo', 'Abuela', 'Conyuge', 'Otro'
    ];

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    private flatpickrInstance: any = null;
    @ViewChild('filtroFechaInput', { static: false }) set filtroFechaInput(element: ElementRef) {
        if (element && !this.flatpickrInstance) {
            setTimeout(() => {
                let minDate: Date | string | undefined = undefined;
                let maxDate: Date | string | undefined = undefined;

                if (this.tratamiento) {
                    const inicio = this.tratamiento.fechaInicio || this.tratamiento.fechainicio;
                    const fin = this.tratamiento.fechaFin || this.tratamiento.fechafin;

                    if (inicio) {
                        const d = new Date(inicio);
                        if (!isNaN(d.getTime())) {
                            minDate = d;
                        }
                    }
                    if (fin) {
                        const d = new Date(fin);
                        if (!isNaN(d.getTime())) {
                            maxDate = d;
                        }
                    }
                }

                this.flatpickrInstance = flatpickr(element.nativeElement, {
                    locale: Spanish,
                    dateFormat: 'Y-m-d',
                    allowInput: false,
                    disableMobile: true,
                    minDate: minDate,
                    maxDate: maxDate,
                    onChange: (selectedDates: Date[], dateStr: string) => {
                        this.filtroFecha = dateStr;
                        this.cdr.detectChanges();
                    }
                });
            }, 0);
        }
    }

    get registrosTomasFiltrados(): RegistroToma[] {
        if (!this.filtroFecha || this.filtroFecha.trim() === '') {
            return this.registrosTomas;
        }

        const partes = this.filtroFecha.split('-').map(Number);
        const filtroAnio = partes[0];
        const filtroMes = partes[1] - 1;
        const filtroDia = partes[2];

        return this.registrosTomas.filter(toma => {
            try {
                const fechaToma = new Date(toma.fechaProgramada);
                const tomaAnio = fechaToma.getFullYear();
                const tomaMes = fechaToma.getMonth();
                const tomaDia = fechaToma.getDate();

                return tomaAnio === filtroAnio && tomaMes === filtroMes && tomaDia === filtroDia;
            } catch {
                return false;
            }
        });
    }

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        const storedUser = localStorage.getItem('user_htas');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            this.caregiverId = userData.idusuario || userData.uid || null;
        }

        this.route.params.subscribe(params => {
            this.tratamientoId = +params['id'];
            if (this.tratamientoId) {
                this.cargarTratamiento(this.tratamientoId);
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

    async cargarTratamiento(id: number) {
        this.isLoading = true;
        try {
            const data = await firstValueFrom(this.usersService.getTratamientoById(id));

            const idPaciente = data.idpaciente || data.IdPaciente || data.idPaciente;
            this.tieneAcceso = false;
            this.solicitudEnviada = false;

            let nombreCompleto = 'Paciente';

            if (idPaciente) {
                try {
                    const pacienteData = await firstValueFrom(this.usersService.getUsuarioById(idPaciente));
                    if (pacienteData) {
                        const nombre = pacienteData.nombre || '';
                        const apPaterno = pacienteData.apPaterno || '';
                        const apMaterno = pacienteData.apMaterno || '';
                        nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        if (!nombreCompleto) {
                            nombreCompleto = pacienteData.correo || 'Paciente';
                        }
                    }
                } catch (error) {
                    console.error('Error al obtener datos del paciente:', error);
                }
            }

            this.tratamiento = {
                ...data,
                idpaciente: idPaciente,
                nombreMedicamento: data.nombremedicamento || data.NombreMedicamento || 'Medicamento',
                fechaInicio: data.fechainicio || data.FechaInicio,
                fechaFin: data.fechafin || data.FechaFin,
                nombrePaciente: nombreCompleto,
                paciente: nombreCompleto
            };

            await this.verificarAccesoPaciente(idPaciente);
            await this.cargarTomas(id);

        } catch (error) {
            console.error('Error al cargar tratamiento:', error);
            this.showError('Error', 'No se pudo cargar la informacion del tratamiento.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async verificarAccesoPaciente(idPaciente: number) {
        try {
            const pacientesAsignados = await firstValueFrom(
                this.usersService.getPacientesAsignados(this.caregiverId!)
            );

            if (Array.isArray(pacientesAsignados)) {
                const tieneAcceso = pacientesAsignados.some(p => (p.idusuario || p.id) === idPaciente);
                this.tieneAcceso = tieneAcceso;
            }

            if (!this.tieneAcceso) {
                const solicitudes = await firstValueFrom(
                    this.usersService.getMisSolicitudes(this.caregiverId!)
                );
                if (Array.isArray(solicitudes)) {
                    const pendiente = solicitudes.some(s => s.idpaciente === idPaciente && s.estado === 'pendiente');
                    this.solicitudEnviada = pendiente;
                }
            }
        } catch (error) {
            console.error('Error al verificar acceso:', error);
        }
    }

    async cargarTomas(idTratamiento: number) {
        try {
            this.cargandoTomas = true;
            this.cdr.detectChanges();

            const [tomas, estadisticas] = await Promise.all([
                firstValueFrom(this.usersService.getTomasByTratamiento(idTratamiento)),
                firstValueFrom(this.usersService.getEstadisticasTomas(idTratamiento))
            ]);

            if (tomas && Array.isArray(tomas)) {
                this.registrosTomas = tomas.map((t: any) => ({
                    ...t,
                    fechaFormateada: this.formatearFecha(t.fechaProgramada),
                    horaFormateada: this.formatearHora(t.fechaProgramada)
                }));
            }

            if (estadisticas) {
                this.estadisticasTomas = estadisticas;
            }

            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error al cargar tomas:', error);
            this.showError('Error', 'No se pudieron cargar las tomas.');
        } finally {
            this.cargandoTomas = false;
            this.cdr.detectChanges();
        }
    }

    abrirModalSolicitud() {
        this.parentesco = '';
        this.notas = '';
        this.mostrarModalSolicitud = true;
        this.cdr.detectChanges();
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.parentesco = '';
        this.notas = '';
        this.enviandoSolicitud = false;
    }

    async enviarSolicitud() {
        if (!this.parentesco) {
            this.showWarning('Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            const paciente = await firstValueFrom(
                this.usersService.getUsuarioById(this.tratamiento.idpaciente)
            );

            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: paciente.correo,
                    parentesco: this.parentesco,
                    notas: this.notas
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

    obtenerMes(fecha: string): string {
        if (!fecha) return '';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return meses[d.getMonth()] || '';
        } catch {
            return '';
        }
    }

    obtenerDia(fecha: string): string {
        if (!fecha) return '??';
        try {
            const d = new Date(fecha);
            return d.getDate().toString().padStart(2, '0');
        } catch {
            return '??';
        }
    }

    formatearHora(fecha: string): string {
        if (!fecha) return 'S/H';
        try {
            const d = new Date(fecha);
            const horas = d.getHours().toString().padStart(2, '0');
            const minutos = d.getMinutes().toString().padStart(2, '0');
            return `${horas}:${minutos}`;
        } catch {
            return 'S/H';
        }
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    formatearFechaCompleta(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return `${diasSemana[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    getEstadoColor(estado: string): string {
        const colores: { [key: string]: string } = {
            'Tomada': '#10b981',
            'Pendiente': '#f59e0b',
            'Omitida': '#ef4444',
            'Retrasada': '#f97316',
            'Eliminada': '#6c757d'
        };
        return colores[estado] || '#6c757d';
    }

    getEstadoIcono(estado: string): string {
        const iconos: { [key: string]: string } = {
            'Tomada': 'bi-check-circle-fill',
            'Pendiente': 'bi-clock-fill',
            'Omitida': 'bi-x-circle-fill',
            'Retrasada': 'bi-exclamation-triangle-fill',
            'Eliminada': 'bi-trash-fill'
        };
        return iconos[estado] || 'bi-question-circle';
    }

    getEstadoClass(activo: boolean): string {
        return activo ? 'estado-activo' : 'estado-inactivo';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    esTratamientoVencido(fechaFin: string): boolean {
        if (!fechaFin) return false;
        try {
            const hoy = new Date();
            const fin = new Date(fechaFin);
            return fin < hoy;
        } catch {
            return false;
        }
    }

    volver() {
        this.router.navigate(['/caregiver/tratamientos']);
    }
}