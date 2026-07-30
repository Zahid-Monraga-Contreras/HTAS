import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
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
    selector: 'app-doctor-medicamento-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, DoctorMenu],
    templateUrl: './medicamento-detalle.html',
    styleUrls: ['./medicamento-detalle.css']
})
export class DoctorMedicamentoDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    medicamentoId: number | null = null;
    medicamento: any = null;
    cargandoAccion = false;

    estadisticas: any = null;
    cargandoEstadisticas = false;

    tratamientosRelacionados: any[] = [];
    mostrandoTratamientos = false;

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    mostrarModalConfirmacion = false;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    mostrarModalEdicion = false;
    editandoMedicamento = {
        nombreComercial: '',
        sustanciaActiva: '',
        presentacion: '',
        concentracion: '',
        laboratorio: '',
        indicacionesGenerales: ''
    };

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.route.params.subscribe(params => {
            this.medicamentoId = +params['id'];
            if (this.medicamentoId) {
                this.cargarMedicamento(this.medicamentoId);
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

    async cargarMedicamento(id: number) {
        this.isLoading = true;
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

            // Procesar tratamientos relacionados
            if (data.tratamientosrelacionados && Array.isArray(data.tratamientosrelacionados)) {
                this.tratamientosRelacionados = data.tratamientosrelacionados.map((t: any) => {
                    // El backend ya envía el nombre del paciente en el campo "Paciente"
                    // Solo necesitamos asegurarnos de que se use correctamente
                    const nombrePaciente = t.Paciente || t.paciente || 'Paciente sin nombre';

                    return {
                        ...t,
                        idtratamiento: t.IdTratamiento || t.idtratamiento || t.id,
                        idpaciente: t.IdPaciente || t.idPaciente || t.idpaciente,
                        // Usar el nombre que ya viene del backend
                        paciente: nombrePaciente,
                        nombrePaciente: nombrePaciente,
                        NombrePaciente: nombrePaciente,
                        fechainicio: t.FechaInicio || t.fechainicio || t.fechaInicio,
                        fechafin: t.FechaFin || t.fechafin || t.fechaFin,
                        activo: t.Activo !== undefined ? t.Activo : t.activo
                    };
                });
                this.mostrandoTratamientos = this.tratamientosRelacionados.length > 0;
            } else {
                this.tratamientosRelacionados = [];
                this.mostrandoTratamientos = false;
            }

            await this.cargarEstadisticas(id);

        } catch (error) {
            console.error('Error al cargar medicamento:', error);
            this.showError('Error', 'No se pudo cargar la informacion del medicamento.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    async cargarEstadisticas(id: number) {
        try {
            this.cargandoEstadisticas = true;
            const data = await firstValueFrom(this.usersService.getEstadisticasMedicamento(id));
            this.estadisticas = data;
        } catch (error) {
            console.error('Error al cargar estadisticas:', error);
        } finally {
            this.cargandoEstadisticas = false;
            this.cdr.detectChanges();
        }
    }

    abrirModalEdicion() {
        this.editandoMedicamento = {
            nombreComercial: this.medicamento.nombreComercial || '',
            sustanciaActiva: this.medicamento.sustanciaActiva || '',
            presentacion: this.medicamento.presentacion || '',
            concentracion: this.medicamento.concentracion || '',
            laboratorio: this.medicamento.laboratorio || '',
            indicacionesGenerales: this.medicamento.indicacionesGenerales || ''
        };
        this.mostrarModalEdicion = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalEdicion() {
        this.mostrarModalEdicion = false;
        document.body.style.overflow = '';
    }

    async ejecutarActualizarMedicamento() {
        if (!this.editandoMedicamento.nombreComercial.trim()) {
            this.showWarning('Campo requerido', 'El nombre comercial es obligatorio.');
            return;
        }

        if (!this.editandoMedicamento.presentacion.trim()) {
            this.showWarning('Campo requerido', 'La presentacion es obligatoria.');
            return;
        }

        this.cargandoAccion = true;
        this.cdr.detectChanges();

        try {
            const id = this.medicamento.idmedicamento || this.medicamento.id;

            await firstValueFrom(this.usersService.actualizarMedicamento(id, {
                nombreComercial: this.editandoMedicamento.nombreComercial,
                sustanciaActiva: this.editandoMedicamento.sustanciaActiva || null,
                presentacion: this.editandoMedicamento.presentacion,
                concentracion: this.editandoMedicamento.concentracion || null,
                laboratorio: this.editandoMedicamento.laboratorio || null,
                indicacionesGenerales: this.editandoMedicamento.indicacionesGenerales || null
            }));

            this.cerrarModalEdicion();
            this.showSuccess('Actualizado', 'El medicamento ha sido actualizado exitosamente.');

            await this.cargarMedicamento(this.medicamentoId!);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al actualizar el medicamento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Actualizar', mensajeError);
        } finally {
            this.cargandoAccion = false;
            this.cdr.detectChanges();
        }
    }

    mostrarConfirmacionEliminar() {
        this.modalConfirmacion = {
            titulo: 'Eliminar Medicamento',
            mensaje: 'Esta seguro de que desea eliminar este medicamento? Esta accion no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        document.body.style.overflow = '';
    }

    async ejecutarEliminarMedicamento() {
        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const id = this.medicamento.idmedicamento || this.medicamento.id;

            await firstValueFrom(this.usersService.eliminarMedicamento(id));

            this.cerrarModalConfirmacion();
            this.showSuccess(
                'Medicamento Eliminado',
                'El medicamento ha sido eliminado exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/medicamentos']);
            }, 1000);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al eliminar el medicamento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.error?.message) {
                mensajeError = error.error.message;
            } else if (error.message) {
                mensajeError = error.message;
            }

            if (error.status === 400 && error.error?.tratamientos) {
                const total = error.error.totalTratamientos || 0;
                mensajeError = `No se puede eliminar el medicamento porque esta asociado a ${total} tratamiento(s).`;
            }

            this.showError('Error al Eliminar', mensajeError);
            this.cerrarModalConfirmacion();
        } finally {
            this.cargandoEliminar = false;
            this.cdr.detectChanges();
        }
    }

    volver() {
        this.router.navigate(['/doctor/medicamentos']);
    }

    verTratamiento(id: number) {
        if (id) {
            this.router.navigate(['/doctor/tratamientos/detalle', id]);
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