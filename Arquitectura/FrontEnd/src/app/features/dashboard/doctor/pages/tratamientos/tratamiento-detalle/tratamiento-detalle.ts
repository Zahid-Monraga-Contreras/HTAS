import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

// Importamos Flatpickr
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
    selector: 'app-doctor-tratamiento-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, DoctorMenu],
    templateUrl: './tratamiento-detalle.html',
    styleUrls: ['./tratamiento-detalle.css']
})
export class DoctorTratamientoDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    tratamientoId: number | null = null;
    tratamiento: any = null;
    cargandoAccion = false;

    // Tomas
    registrosTomas: RegistroToma[] = [];
    estadisticasTomas: any = null;
    cargandoTomas = false;
    generandoTomas = false;
    eliminandoTomas = false;
    mostrarModalTomas = false;

    // Filtro de búsqueda por fecha (Formato string YYYY-MM-DD)
    filtroFecha: string = '';

    // Modal de eliminacion de tomas
    mostrarModalEliminarToma = false;
    tomaAEliminar: number | null = null;
    mostrarModalEliminarTodas = false;

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    // Modal de confirmacion para eliminar
    mostrarModalConfirmacion = false;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    // Modal para cambiar estado
    mostrarModalEstado = false;
    nuevoEstado: boolean = false;

    // ViewChild dinámico con setter
    private flatpickrInstance: any = null;
    @ViewChild('filtroFechaInput', { static: false }) set filtroFechaInput(element: ElementRef) {
        if (element && !this.flatpickrInstance) {
            // Esperamos un tick para asegurar que el DOM está listo
            setTimeout(() => {
                // Obtenemos las fechas del tratamiento para limitar el calendario
                // Usamos undefined en lugar de null para evitar errores de TypeScript
                let minDate: Date | string | undefined = undefined;
                let maxDate: Date | string | undefined = undefined;

                // Solo definimos los límites si el tratamiento ya está cargado
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
                    allowInput: false, // Prohibe escribir a mano
                    disableMobile: true,
                    minDate: minDate, // Fecha mínima permitida (undefined si no hay)
                    maxDate: maxDate, // Fecha máxima permitida (undefined si no hay)
                    onChange: (selectedDates: Date[], dateStr: string) => {
                        this.filtroFecha = dateStr;
                        this.cdr.detectChanges();
                    }
                });
            }, 0);
        }
    }

    // Propiedad computada para la lista filtrada
    get registrosTomasFiltrados(): RegistroToma[] {
        if (!this.filtroFecha || this.filtroFecha.trim() === '') {
            return this.registrosTomas;
        }

        // Parseo manual para evitar errores de zona horaria (UTC vs Local)
        const partes = this.filtroFecha.split('-').map(Number);
        const filtroAnio = partes[0];
        const filtroMes = partes[1] - 1; // En JS los meses van de 0 a 11
        const filtroDia = partes[2];

        return this.registrosTomas.filter(toma => {
            try {
                const fechaToma = new Date(toma.fechaProgramada);
                const tomaAnio = fechaToma.getFullYear();
                const tomaMes = fechaToma.getMonth();
                const tomaDia = fechaToma.getDate();

                // Comparar año, mes y día exactamente
                return tomaAnio === filtroAnio && tomaMes === filtroMes && tomaDia === filtroDia;
            } catch {
                return false;
            }
        });
    }

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

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
            this.tratamiento = {
                ...data,
                nombreMedicamento: data.nombremedicamento || data.NombreMedicamento || 'Medicamento',
                fechaInicio: data.fechainicio || data.FechaInicio,
                fechaFin: data.fechafin || data.FechaFin,
                nombrePaciente: data.NombrePaciente || data.nombrePaciente || 'Paciente',
                nombreDoctor: data.NombreDoctor || data.nombreDoctor || 'Doctor'
            };

            await this.cargarTomas(id);

        } catch (error) {
            console.error('Error al cargar tratamiento:', error);
            this.showError('Error', 'No se pudo cargar la informacion del tratamiento.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ==========================================
    // METODOS PARA EL REGISTRO DE TOMAS
    // ==========================================

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

    tieneTomasGeneradas(): boolean {
        return this.registrosTomas && this.registrosTomas.length > 0;
    }

    isBotonGenerarDisabled(): boolean {
        if (this.generandoTomas) return true;
        if (this.tieneTomasGeneradas()) return true;
        if (!this.tratamiento) return true;
        if (this.tratamiento.activo !== false && this.tratamiento.activo !== 0) return false;
        return true;
    }

    getMensajeBotonGenerar(): string {
        if (this.generandoTomas) {
            return 'Generando...';
        }
        if (this.tieneTomasGeneradas()) {
            return 'Tomas ya generadas';
        }
        return 'Generar Tomas';
    }

    async generarTomas() {
        if (!this.tratamiento) return;

        if (this.tieneTomasGeneradas()) {
            this.showWarning('Atencion', 'Este tratamiento ya tiene tomas generadas.');
            return;
        }

        const fechaInicioValida = this.tratamiento.fechaInicio || this.tratamiento.fechainicio;
        const fechaFinValida = this.tratamiento.fechaFin || this.tratamiento.fechafin;
        let frecuenciaHorasValida = this.tratamiento.frecuenciaHoras || this.tratamiento.frecuenciashoras;

        if (!frecuenciaHorasValida) {
            frecuenciaHorasValida = 8;
        }

        if (!fechaInicioValida || !fechaFinValida) {
            this.showError('Error', 'El tratamiento no tiene fechas de inicio o fin definidas.');
            return;
        }

        this.generandoTomas = true;
        this.cdr.detectChanges();

        try {
            const data = {
                idTratamiento: this.tratamientoId!,
                fechaInicio: fechaInicioValida,
                fechaFin: fechaFinValida,
                frecuenciaHoras: frecuenciaHorasValida
            };

            console.log('Enviando payload al generar tomas:', data);

            const response = await firstValueFrom(
                this.usersService.generarTomasProgramadas(data)
            );

            this.showSuccess(
                'Tomas Generadas',
                `${response.totalGeneradas} tomas generadas exitosamente.`
            );

            await this.cargarTomas(this.tratamientoId!);

        } catch (error: any) {
            console.error('Error al generar tomas:', error);

            let mensajeError = 'No se pudieron generar las tomas.';
            if (error.error && error.error.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.showError('Error', mensajeError);
        } finally {
            this.generandoTomas = false;
            this.cdr.detectChanges();
        }
    }

    confirmarEliminarToma(id: number) {
        this.tomaAEliminar = id;
        this.mostrarModalEliminarToma = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalEliminarToma() {
        this.mostrarModalEliminarToma = false;
        this.tomaAEliminar = null;
        document.body.style.overflow = '';
    }

    async ejecutarEliminarToma() {
        if (!this.tomaAEliminar) return;

        try {
            await firstValueFrom(this.usersService.eliminarToma(this.tomaAEliminar));

            this.showSuccess('Exito', 'Toma eliminada correctamente.');
            this.cerrarModalEliminarToma();
            await this.cargarTomas(this.tratamientoId!);

        } catch (error) {
            console.error('Error al eliminar toma:', error);
            this.showError('Error', 'No se pudo eliminar la toma.');
            this.cerrarModalEliminarToma();
        }
    }

    confirmarEliminarTodasTomas() {
        this.mostrarModalEliminarTodas = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalEliminarTodas() {
        this.mostrarModalEliminarTodas = false;
        document.body.style.overflow = '';
    }

    async ejecutarEliminarTodasTomas() {
        if (!this.tratamientoId) return;

        this.eliminandoTomas = true;
        this.cdr.detectChanges();

        try {
            await firstValueFrom(this.usersService.eliminarTodasTomas(this.tratamientoId));

            this.showSuccess('Exito', 'Todas las tomas han sido eliminadas.');
            this.cerrarModalEliminarTodas();
            await this.cargarTomas(this.tratamientoId!);

        } catch (error) {
            console.error('Error al eliminar tomas:', error);
            this.showError('Error', 'No se pudieron eliminar las tomas.');
            this.cerrarModalEliminarTodas();
        } finally {
            this.eliminandoTomas = false;
            this.cdr.detectChanges();
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

    // ==========================================
    // METODOS DE CONFIRMACION
    // ==========================================

    mostrarConfirmacionEliminar() {
        this.modalConfirmacion = {
            titulo: 'Eliminar Tratamiento',
            mensaje: 'Estas seguro de que deseas eliminar este tratamiento? Esta accion no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        document.body.style.overflow = '';
    }

    async ejecutarEliminarTratamiento() {
        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const id = this.tratamiento.idtratamiento || this.tratamiento.id;

            await firstValueFrom(this.usersService.eliminarTratamiento(id));

            this.cerrarModalConfirmacion();
            this.showSuccess(
                'Tratamiento Eliminado',
                'El tratamiento ha sido eliminado exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/tratamientos']);
            }, 1000);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al eliminar el tratamiento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Eliminar', mensajeError);
            this.cerrarModalConfirmacion();
        } finally {
            this.cargandoEliminar = false;
            this.cdr.detectChanges();
        }
    }

    abrirModalEstado() {
        this.nuevoEstado = this.tratamiento.activo !== false && this.tratamiento.activo !== 0;
        this.mostrarModalEstado = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalEstado() {
        this.mostrarModalEstado = false;
        document.body.style.overflow = '';
    }

    async ejecutarCambiarEstado() {
        this.cargandoAccion = true;
        this.cdr.detectChanges();

        try {
            const id = this.tratamiento.idtratamiento || this.tratamiento.id;
            const activo = this.nuevoEstado;

            await firstValueFrom(this.usersService.toggleEstadoTratamiento(id, activo));

            this.tratamiento.activo = activo;
            this.cerrarModalEstado();

            this.showSuccess(
                'Estado Actualizado',
                `El tratamiento ha sido ${activo ? 'activado' : 'desactivado'} exitosamente.`
            );

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al cambiar el estado del tratamiento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Actualizar', mensajeError);
            this.cerrarModalEstado();
        } finally {
            this.cargandoAccion = false;
            this.cdr.detectChanges();
        }
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
        this.router.navigate(['/doctor/tratamientos']);
    }

    irAPaciente() {
        const idPaciente = this.tratamiento.idpaciente || this.tratamiento.IdPaciente;
        if (idPaciente) {
            this.router.navigate(['/doctor/pacientes/detalle', idPaciente]);
        }
    }
}