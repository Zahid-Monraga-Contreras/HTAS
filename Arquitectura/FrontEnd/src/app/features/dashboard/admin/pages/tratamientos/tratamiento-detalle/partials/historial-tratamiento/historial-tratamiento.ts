import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface HistorialCambio {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
}

@Component({
    selector: 'app-historial-tratamiento',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './historial-tratamiento.html',
    styleUrls: ['./historial-tratamiento.css']
})
export class HistorialTratamiento implements OnInit {
    @Input() tratamientoSeleccionado: any = null;
    @Input() historialCambios: HistorialCambio[] = [];
    @Input() estadisticas: any = null;
    @Output() volver = new EventEmitter<void>();

    constructor() { }

    ngOnInit() { }

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

    contarCambiosDosis(): number {
        if (!this.historialCambios || this.historialCambios.length === 0) {
            return 0;
        }
        return this.historialCambios.filter(h => h.accion.includes('Dosis')).length;
    }

    contarCambiosEstado(): number {
        if (!this.historialCambios || this.historialCambios.length === 0) {
            return 0;
        }
        return this.historialCambios.filter(h =>
            h.accion.includes('activado') ||
            h.accion.includes('desactivado')
        ).length;
    }

    onVolver() {
        this.volver.emit();
    }
}