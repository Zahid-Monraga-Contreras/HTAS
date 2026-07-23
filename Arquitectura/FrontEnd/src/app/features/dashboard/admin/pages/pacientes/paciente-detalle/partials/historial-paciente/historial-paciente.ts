import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HistorialPaciente {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
}

@Component({
    selector: 'app-historial-paciente',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './historial-paciente.html',
    styleUrls: ['./historial-paciente.css']
})
export class HistorialPacienteComponent {
    @Input() estadisticas: {
        totalCitas: number;
        citasCompletadas: number;
        citasPendientes: number;
        citasCanceladas: number;
        ultimaCita: string | null;
        proximaCita: string | null;
    } | null = null;

    @Input() citasPaciente: any[] = [];
    @Input() historialCambios: HistorialPaciente[] = [];

    formatearFechaYHora(fecha: string, hora: string): string {
        if (!fecha) return 'Fecha no disponible';

        try {
            const fechaObj = new Date(fecha);

            if (isNaN(fechaObj.getTime())) {
                return fecha;
            }

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