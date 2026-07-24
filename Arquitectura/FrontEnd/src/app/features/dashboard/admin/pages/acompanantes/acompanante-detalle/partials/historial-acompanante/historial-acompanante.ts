import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface HistorialItem {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
}

@Component({
    selector: 'app-historial-acompanante',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './historial-acompanante.html',
    styleUrls: ['./historial-acompanante.css']
})
export class HistorialAcompanante {
    @Input() historialCambios: HistorialItem[] = [];
    @Input() visitasAcompanante: any[] = [];
    @Input() estadisticas: {
        totalVisitas: number;
        visitasCompletadas: number;
        visitasPendientes: number;
        visitasCanceladas: number;
        ultimaVisita: string | null;
        proximaVisita: string | null;
    } | null = null;

    formatearFechaYHora(fecha: string, hora: string): string {
        if (!fecha) return 'Fecha no disponible';

        try {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) return fecha;

            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anio = fechaObj.getFullYear();
            const fechaFormateada = `${dia}/${mes}/${anio}`;

            let horaFormateada = '--:--';
            if (hora) {
                let horaLimpia = hora;
                if (horaLimpia.includes('T')) {
                    horaLimpia = horaLimpia.split('T')[1] || '00:00';
                }
                if (horaLimpia.length > 5) {
                    horaLimpia = horaLimpia.substring(0, 5);
                }
                if (horaLimpia.includes(':')) {
                    const partes = horaLimpia.split(':');
                    if (partes.length >= 2) {
                        horaFormateada = `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
                    }
                } else {
                    horaFormateada = horaLimpia;
                }
            }

            return `${fechaFormateada} ${horaFormateada}`;
        } catch (error) {
            return fecha;
        }
    }
}