import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-patient-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.css']
})
export class PatientPerfil {
  perfil = {
    nombre: 'Juan Pérez',
    email: 'juan@email.com',
    telefono: '1234567890',
    nss: '12345678901',
    fechaNacimiento: '1990-01-15',
    alergias: 'Ninguna',
    grupoSanguineo: 'O+'
  };

  constructor() { }
}