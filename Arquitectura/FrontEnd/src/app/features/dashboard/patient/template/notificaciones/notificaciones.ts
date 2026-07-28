import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-patient-notificaciones',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notificaciones.html',
    styleUrls: ['./notificaciones.css']
})
export class PatientNotificaciones {
    notificaciones = [
        { id: 1, titulo: 'Nueva cita agendada', mensaje: 'Tienes una nueva cita con el Dr. García para el 30/07/2024', fecha: '2024-07-26', leida: false },
        { id: 2, titulo: 'Recordatorio de medicamento', mensaje: 'No olvides tomar tu medicamento a las 8:00 PM', fecha: '2024-07-26', leida: true },
        { id: 3, titulo: 'Resultados de laboratorio', mensaje: 'Tus resultados de laboratorio están disponibles', fecha: '2024-07-25', leida: false }
    ];

    constructor() { }

    marcarComoLeida(id: number) {
        const notificacion = this.notificaciones.find(n => n.id === id);
        if (notificacion) {
            notificacion.leida = true;
        }
    }

    eliminarNotificacion(id: number) {
        this.notificaciones = this.notificaciones.filter(n => n.id !== id);
    }
}