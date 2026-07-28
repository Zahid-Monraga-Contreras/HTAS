import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-patient-tratamientos',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './tratamientos.html',
    styleUrls: ['./tratamientos.css']
})
export class PatientTratamientos {
    tratamientos = [
        { id: 1, nombre: 'Terapia Física', medico: 'Dr. Pérez', fechaInicio: '2024-07-01', estado: 'Activo' },
        { id: 2, nombre: 'Rehabilitación', medico: 'Dra. López', fechaInicio: '2024-06-15', estado: 'Completado' }
    ];

    constructor() { }
}