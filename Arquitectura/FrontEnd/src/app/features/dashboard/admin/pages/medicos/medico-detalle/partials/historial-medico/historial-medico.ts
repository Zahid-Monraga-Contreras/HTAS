import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HistorialMedico {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
}

@Component({
    selector: 'app-historial-medico',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './historial-medico.html',
    styleUrls: ['./historial-medico.css']
})
export class HistorialMedicoComponent {
    @Input() estadisticas: {
        totalPacientes: number;
        citasCompletadas: number;
        citasPendientes: number;
        promedioConsultas: number;
    } | null = null;

    @Input() pacientesAtendidos: any[] = [];
    @Input() historialCambios: HistorialMedico[] = [];
}