import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-error-404',
  imports: [],
  templateUrl: './error-404.html',
  styleUrl: './error-404.css',
})
export class Error404 {

  constructor(private router: Router, private location: Location) { }

  goToHome() {
    this.router.navigate(['/landing']); // Redirige a la ruta principal
  }

  goBack() {
    this.location.back(); // Regresa a la página anterior en el historial
  }

}