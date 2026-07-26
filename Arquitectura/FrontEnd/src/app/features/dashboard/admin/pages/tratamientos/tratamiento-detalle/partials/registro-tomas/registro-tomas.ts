import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

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
    selector: 'app-registro-tomas',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './registro-tomas.html',
    styleUrls: ['./registro-tomas.css']
})
export class RegistroTomas implements OnInit, OnDestroy {
    @Input() tratamientoSeleccionado: any = null;
    @Input() registrosTomas: RegistroToma[] = [];
    @Input() estadisticas: any = null;
    @Input() generandoTomas = false;
    @Input() eliminandoTomas = false; // Nuevo input para estado de eliminación masiva
    @Output() generarTomas = new EventEmitter<void>();
    @Output() actualizarToma = new EventEmitter<{ id: number; estado: string }>();
    @Output() eliminarToma = new EventEmitter<number>(); // Para eliminar una sola
    @Output() eliminarTodasTomas = new EventEmitter<void>(); // Nuevo output para eliminar todas
    @Output() volver = new EventEmitter<void>();

    private usersService = inject(Users);
    private cdr = inject(ChangeDetectorRef);

    // Modal de confirmación
    mostrarModalConfirmacion = false;
    modalConfirmacionMensaje = '';
    modalConfirmacionAccion: (() => void) | null = null;

    // Modal para eliminar toma individual
    mostrarModalEliminar = false;
    tomaAEliminar: number | null = null;

    // Modal para eliminar todas las tomas
    mostrarModalEliminarTodas = false;

    // Notificaciones Toast
    mostrarToast = false;
    mensajeToast = '';
    tipoToast: 'success' | 'error' | 'warning' = 'success';
    private toastTimeout: any = null;

    ngOnInit() { }

    ngOnDestroy() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
    }

    getEstadoTratamiento(): { texto: string; color: string } {
        if (!this.tratamientoSeleccionado) {
            return { texto: 'Sin datos', color: '#6c757d' };
        }

        if (this.tratamientoSeleccionado.activo === false) {
            return { texto: 'Inactivo', color: '#ef4444' };
        }

        const hoy = new Date();
        const fechaFin = new Date(this.tratamientoSeleccionado.fechafin);

        if (fechaFin < hoy) {
            return { texto: 'Finalizado', color: '#3b82f6' };
        }

        if (this.estadisticas && this.estadisticas.porcentajeCumplimiento < 70 && this.estadisticas.porcentajeCumplimiento > 0) {
            return { texto: 'Bajo cumplimiento', color: '#f59e0b' };
        }

        return { texto: 'Activo', color: '#10b981' };
    }

    getFrecuenciaTexto(): string {
        const horas = this.tratamientoSeleccionado?.frecuenciahoras;
        if (!horas) return 'Sin frecuencia';

        if (horas === 24) return 'Cada 24 horas (1 vez al día)';
        if (horas === 12) return 'Cada 12 horas (2 veces al día)';
        if (horas === 8) return 'Cada 8 horas (3 veces al día)';
        if (horas === 6) return 'Cada 6 horas (4 veces al día)';
        if (horas === 4) return 'Cada 4 horas (6 veces al día)';
        return `Cada ${horas} horas`;
    }

    getDuracionDias(): number | null {
        if (!this.tratamientoSeleccionado?.fechainicio || !this.tratamientoSeleccionado?.fechafin) return null;
        const inicio = new Date(this.tratamientoSeleccionado.fechainicio);
        const fin = new Date(this.tratamientoSeleccionado.fechafin);
        const diffTime = fin.getTime() - inicio.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

    /**
     * Verifica si hay tomas activas (no eliminadas)
     */
    tieneTomasActivas(): boolean {
        if (!this.registrosTomas || this.registrosTomas.length === 0) {
            return false;
        }
        return this.registrosTomas.some(t => t.estado !== 'Eliminada');
    }

    /**
     * Cuenta cuántas tomas activas hay (no eliminadas)
     */
    getCantidadTomasActivas(): number {
        if (!this.registrosTomas) return 0;
        return this.registrosTomas.filter(t => t.estado !== 'Eliminada').length;
    }

    /**
     * Verifica si una toma puede ser eliminada (solo si está Pendiente o Retrasada)
     */
    puedeEliminarToma(estado: string): boolean {
        return estado === 'Pendiente' || estado === 'Retrasada';
    }

    /**
     * Verifica si una toma puede ser editada (no eliminada)
     */
    puedeEditarToma(estado: string): boolean {
        return estado !== 'Eliminada';
    }

    /**
     * Verifica si ya existen tomas generadas para todo el período del tratamiento
     */
    tieneTomasEnTodoElPeriodo(): boolean {
        if (!this.tratamientoSeleccionado || !this.registrosTomas || this.registrosTomas.length === 0) {
            return false;
        }

        const tomasActivas = this.registrosTomas.filter(t => t.estado !== 'Eliminada');

        if (tomasActivas.length === 0) {
            return false;
        }

        const fechaInicio = new Date(this.tratamientoSeleccionado.fechainicio);
        const fechaFin = new Date(this.tratamientoSeleccionado.fechafin);
        const frecuenciaHoras = parseInt(this.tratamientoSeleccionado.frecuenciahoras) || 8;

        const diffMs = fechaFin.getTime() - fechaInicio.getTime();
        const diffHoras = diffMs / (1000 * 60 * 60);
        const totalTomasEsperadas = Math.ceil(diffHoras / frecuenciaHoras);

        const porcentajeGenerado = (tomasActivas.length / totalTomasEsperadas) * 100;

        return porcentajeGenerado >= 95;
    }

    /**
     * Obtiene el mensaje apropiado para el botón de generar tomas
     */
    getMensajeBotonGenerar(): string {
        if (!this.tratamientoSeleccionado) {
            return 'Generar Tomas Programadas';
        }

        if (this.generandoTomas) {
            return 'Generando...';
        }

        if (this.tieneTomasEnTodoElPeriodo()) {
            return 'Tomas Completas';
        }

        if (this.registrosTomas && this.registrosTomas.length > 0) {
            return 'Generar Tomas Faltantes';
        }

        return 'Generar Tomas Programadas';
    }

    /**
     * Verifica si el botón de generar tomas debe estar deshabilitado
     */
    isBotonGenerarDisabled(): boolean {
        if (this.generandoTomas) {
            return true;
        }

        if (this.tieneTomasEnTodoElPeriodo()) {
            return true;
        }

        if (!this.tratamientoSeleccionado) {
            return true;
        }

        if (!this.tratamientoSeleccionado.fechainicio ||
            !this.tratamientoSeleccionado.fechafin ||
            !this.tratamientoSeleccionado.frecuenciahoras) {
            return true;
        }

        return false;
    }

    /**
     * Verifica si el botón de eliminar todas debe estar deshabilitado
     */
    isBotonEliminarTodasDisabled(): boolean {
        if (this.eliminandoTomas) {
            return true;
        }

        if (!this.tieneTomasActivas()) {
            return true;
        }

        if (!this.tratamientoSeleccionado) {
            return true;
        }

        return false;
    }

    onGenerarTomas() {
        if (this.tieneTomasEnTodoElPeriodo()) {
            this.lanzarNotificacion(
                'Ya existen todas las tomas programadas para este tratamiento.',
                'warning'
            );
            return;
        }

        if (!this.registrosTomas || this.registrosTomas.length === 0) {
            const tomasEstimadas = this.calcularTomasEstimadas();
            this.mostrarModal(
                `¿Generar ${tomasEstimadas} tomas programadas para este tratamiento?`,
                () => {
                    this.generarTomas.emit();
                }
            );
            return;
        }

        const tomasFaltantes = this.calcularTomasFaltantes();
        this.mostrarModal(
            `Faltan ${tomasFaltantes} tomas por generar. ¿Deseas generarlas?`,
            () => {
                this.generarTomas.emit();
            }
        );
    }

    /**
     * Calcula cuántas tomas faltan por generar
     */
    calcularTomasFaltantes(): number {
        if (!this.tratamientoSeleccionado) return 0;

        const totalEstimadas = this.calcularTomasEstimadas();
        const tomasActivas = this.registrosTomas?.filter(t => t.estado !== 'Eliminada').length || 0;

        return Math.max(0, totalEstimadas - tomasActivas);
    }

    calcularTomasEstimadas(): number {
        if (!this.tratamientoSeleccionado) return 0;

        const fechaInicio = this.tratamientoSeleccionado.fechainicio;
        const fechaFin = this.tratamientoSeleccionado.fechafin;
        const frecuenciaHoras = parseInt(this.tratamientoSeleccionado.frecuenciahoras) || 8;

        if (!fechaInicio || !fechaFin || !frecuenciaHoras) return 0;

        try {
            const inicio = new Date(fechaInicio);
            const fin = new Date(fechaFin);

            if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 0;

            const diffMs = fin.getTime() - inicio.getTime();
            const diffHoras = diffMs / (1000 * 60 * 60);
            const tomas = Math.ceil(diffHoras / frecuenciaHoras);

            return tomas > 0 ? tomas : 0;
        } catch (error) {
            console.warn('Error calculando tomas estimadas:', error);
            return 0;
        }
    }

    /**
     * Abre el modal de confirmación para eliminar una toma individual
     */
    abrirModalEliminarToma(id: number) {
        const toma = this.registrosTomas.find(t => t.id === id);
        if (!toma) return;

        if (!this.puedeEliminarToma(toma.estado)) {
            this.lanzarNotificacion(
                `No se puede eliminar una toma con estado "${toma.estado}". Solo se pueden eliminar tomas Pendientes o Retrasadas.`,
                'warning'
            );
            return;
        }

        this.tomaAEliminar = id;
        this.mostrarModalEliminar = true;
        this.cdr.detectChanges();
    }

    /**
     * Confirma la eliminación de una toma individual
     */
    confirmarEliminarToma() {
        if (this.tomaAEliminar !== null) {
            this.eliminarToma.emit(this.tomaAEliminar);
            this.lanzarNotificacion('La toma ha sido eliminada correctamente.', 'success');
            this.cerrarModalEliminar();
        }
    }

    /**
     * Cierra el modal de eliminación individual
     */
    cerrarModalEliminar() {
        this.mostrarModalEliminar = false;
        this.tomaAEliminar = null;
        this.cdr.detectChanges();
    }

    /**
     * Abre el modal de confirmación para eliminar todas las tomas
     */
    abrirModalEliminarTodas() {
        const totalActivas = this.getCantidadTomasActivas();

        if (totalActivas === 0) {
            this.lanzarNotificacion('No hay tomas activas para eliminar.', 'warning');
            return;
        }

        this.mostrarModalEliminarTodas = true;
        this.cdr.detectChanges();
    }

    /**
     * Confirma la eliminación de todas las tomas
     */
    confirmarEliminarTodas() {
        this.cerrarModalEliminarTodas();
        this.eliminarTodasTomas.emit();
    }

    /**
     * Cierra el modal de eliminación de todas las tomas
     */
    cerrarModalEliminarTodas() {
        this.mostrarModalEliminarTodas = false;
        this.cdr.detectChanges();
    }

    onActualizarEstado(id: number, estado: string) {
        const estadoTexto = {
            'Tomada': 'completada',
            'Pendiente': 'pendiente',
            'Omitida': 'omitida',
            'Retrasada': 'retrasada'
        }[estado] || estado;

        this.mostrarModal(
            `¿Marcar esta toma como ${estadoTexto}?`,
            () => {
                this.actualizarToma.emit({ id, estado });
            }
        );
    }

    // MODAL DE CONFIRMACIÓN GENERAL
    mostrarModal(mensaje: string, accion: () => void) {
        this.modalConfirmacionMensaje = mensaje;
        this.modalConfirmacionAccion = accion;
        this.mostrarModalConfirmacion = true;
        this.cdr.detectChanges();
    }

    cerrarModal() {
        this.mostrarModalConfirmacion = false;
        this.modalConfirmacionAccion = null;
        this.cdr.detectChanges();
    }

    confirmarModal() {
        if (this.modalConfirmacionAccion) {
            this.modalConfirmacionAccion();
        }
        this.cerrarModal();
    }

    onVolver() {
        this.volver.emit();
    }

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
}