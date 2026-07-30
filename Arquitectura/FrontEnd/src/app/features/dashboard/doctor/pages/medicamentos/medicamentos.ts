import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-medicamentos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        DoctorMenu
    ],
    templateUrl: './medicamentos.html',
    styleUrls: ['./medicamentos.css']
})
export class DoctorMedicamentos implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    medicamentos: any[] = [];
    medicamentosFiltrados: any[] = [];
    filterTipo: string = 'todos';
    filterLaboratorio: string = 'todos';
    searchTerm: string = '';

    estadisticas = {
        total: 0,
        conTratamientos: 0,
        sinTratamientos: 0,
        laboratorios: 0
    };

    laboratoriosDisponibles: string[] = [];

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    mostrarModalConfirmacion = false;
    medicamentoParaEliminar: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
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

    mostrarConfirmacionEliminar(medicamento: any) {
        this.medicamentoParaEliminar = medicamento;
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
        this.medicamentoParaEliminar = null;
        document.body.style.overflow = '';
    }

    irANuevoMedicamento() {
        this.router.navigate(['/doctor/medicamentos/nuevo']);
    }

    async ejecutarEliminarMedicamento() {
        if (!this.medicamentoParaEliminar) {
            this.cerrarModalConfirmacion();
            return;
        }

        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const id = this.medicamentoParaEliminar.idmedicamento || this.medicamentoParaEliminar.id;

            await firstValueFrom(this.usersService.eliminarMedicamento(id));

            this.cerrarModalConfirmacion();
            this.showSuccess(
                'Medicamento Eliminado',
                'El medicamento ha sido eliminado exitosamente.'
            );

            setTimeout(async () => {
                await this.cargarDatos();
                this.cdr.detectChanges();
            }, 300);

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

    async cargarDatos() {
        this.isLoading = true;
        try {
            await this.cargarMedicamentos();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los medicamentos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarMedicamentos() {
        try {
            const data = await firstValueFrom(this.usersService.getMedicamentos());

            if (Array.isArray(data)) {
                this.medicamentos = data.map(m => ({
                    ...m,
                    nombreComercial: m.nombrecomercial || m.NombreComercial || 'Medicamento',
                    sustanciaActiva: m.sustanciaactiva || m.SustanciaActiva,
                    presentacion: m.presentacion || m.Presentacion,
                    concentracion: m.concentracion || m.Concentracion,
                    laboratorio: m.laboratorio || m.Laboratorio,
                    totalTratamientos: m.totaltratamientos || m.TotalTratamientos || 0,
                    tratamientosActivos: m.tratamientosactivos || m.TratamientosActivos || 0
                }));

                this.calcularEstadisticas();
                this.obtenerLaboratorios();
                this.aplicarFiltros();
            } else {
                this.medicamentos = [];
            }
        } catch (error) {
            console.error('Error al cargar medicamentos:', error);
            this.medicamentos = [];
        }
    }

    private calcularEstadisticas() {
        this.estadisticas.total = this.medicamentos.length;
        this.estadisticas.conTratamientos = this.medicamentos.filter(m => m.totalTratamientos > 0).length;
        this.estadisticas.sinTratamientos = this.medicamentos.filter(m => m.totalTratamientos === 0).length;

        const laboratorios = new Set<string>();
        this.medicamentos.forEach(m => {
            if (m.laboratorio) {
                laboratorios.add(m.laboratorio);
            }
        });
        this.estadisticas.laboratorios = laboratorios.size;
    }

    private obtenerLaboratorios() {
        const labs = new Set<string>();
        this.medicamentos.forEach(m => {
            if (m.laboratorio) {
                labs.add(m.laboratorio);
            }
        });
        this.laboratoriosDisponibles = Array.from(labs).sort();
    }

    aplicarFiltroPorTipo(tipo: string) {
        this.filterTipo = tipo;
        this.aplicarFiltros();
    }

    aplicarFiltroPorLaboratorio(laboratorio: string) {
        this.filterLaboratorio = laboratorio;
        this.aplicarFiltros();
    }

    buscarMedicamentos() {
        this.aplicarFiltros();
    }

    private aplicarFiltros() {
        const term = this.searchTerm.toLowerCase().trim();

        this.medicamentosFiltrados = this.medicamentos.filter(m => {
            let matchTipo = true;
            if (this.filterTipo === 'con-uso') {
                matchTipo = m.totalTratamientos > 0;
            } else if (this.filterTipo === 'sin-uso') {
                matchTipo = m.totalTratamientos === 0;
            }

            let matchLaboratorio = true;
            if (this.filterLaboratorio !== 'todos') {
                matchLaboratorio = (m.laboratorio || '').toLowerCase() === this.filterLaboratorio.toLowerCase();
            }

            let matchSearch = true;
            if (term) {
                matchSearch =
                    (m.nombreComercial || '').toLowerCase().includes(term) ||
                    (m.sustanciaActiva || '').toLowerCase().includes(term) ||
                    (m.laboratorio || '').toLowerCase().includes(term) ||
                    (m.presentacion || '').toLowerCase().includes(term);
            }

            return matchTipo && matchLaboratorio && matchSearch;
        });
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            return d.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return fecha;
        }
    }

    verDetalle(medicamento: any) {
        const id = medicamento.idmedicamento || medicamento.id;
        if (id) {
            this.router.navigate(['/doctor/medicamentos/detalle', id]);
        }
    }
}