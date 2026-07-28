import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-patient-configuracion',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './configuracion.html',
    styleUrls: ['./configuracion.css']
})
export class PatientConfiguracion {
    config = {
        notificaciones: true,
        recordatorios: true,
        idioma: 'es',
        tema: 'claro'
    };

    constructor() { }

    guardarConfiguracion() {
        alert('Configuración guardada correctamente');
        console.log('Configuración guardada:', this.config);
    }
}