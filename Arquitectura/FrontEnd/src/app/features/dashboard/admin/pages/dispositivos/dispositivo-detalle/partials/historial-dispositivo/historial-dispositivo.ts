import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HistorialEvento {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
}

export interface Estadisticas {
    totalMediciones: number;
    promedioSistolica: number;
    promedioDiastolica: number;
    promedioPulso: number;
}

@Component({
    selector: 'app-historial-dispositivo',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './historial-dispositivo.html',
    styleUrls: ['./historial-dispositivo.css']
})
export class HistorialDispositivo {
    @Input() dispositivo: any = null;
    @Input() historialCambios: HistorialEvento[] = [];
    @Input() estadisticas: Estadisticas | null = null;

    @Output() volver = new EventEmitter<void>();

    obtenerNombreCompleto(paciente: any): string {
        if (!paciente) return '';
        const nombre = paciente?.nombre || this.dispositivo?.nombrepaciente || '';
        const apPaterno = paciente?.appaterno || paciente?.apPaterno || this.dispositivo?.appaternopaciente || '';
        const apMaterno = paciente?.apmaterno || paciente?.apMaterno || this.dispositivo?.apmaternopaciente || '';
        return `${nombre} ${apPaterno} ${apMaterno}`.trim();
    }

    onVolver() {
        this.volver.emit();
    }
}