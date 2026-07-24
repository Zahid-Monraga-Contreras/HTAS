import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface HistorialCitaItem {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
}

@Component({
    selector: 'app-historial-cita',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './historial-cita.html',
    styleUrls: ['./historial-cita.css']
})
export class HistorialCita {
    @Input() historialCambios: HistorialCitaItem[] = [];
    @Input() citaSeleccionada: any = null;

    estadosConColor = [
        { value: 'Programada', color: '#FFA726' },
        { value: 'Confirmada', color: '#66BB6A' },
        { value: 'Completada', color: '#42A5F5' },
        { value: 'Cancelada', color: '#EF5350' },
        { value: 'No Asistió', color: '#AB47BC' }
    ];

    getEstadoColor(estado: string): string {
        const found = this.estadosConColor.find(e => e.value === estado);
        return found ? found.color : '#78909C';
    }

    contarCambiosEstado(): number {
        return this.historialCambios.filter(h => h.accion.includes('Estado')).length;
    }

    contarActualizaciones(): number {
        return this.historialCambios.filter(h =>
            h.accion.includes('Motivo') ||
            h.accion.includes('actualizada') ||
            h.accion.includes('modificada')
        ).length;
    }
}