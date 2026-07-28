import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-patient-citas',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './citas.html',
    styleUrls: ['./citas.css']
})
export class PatientCitas {
    citas = [
        { id: 1, fecha: '2024-07-30', doctor: 'Dr. García', especialidad: 'Cardiología', estado: 'Pendiente' },
        { id: 2, fecha: '2024-08-05', doctor: 'Dra. Martínez', especialidad: 'Dermatología', estado: 'Confirmada' }
    ];

    constructor() { }
}