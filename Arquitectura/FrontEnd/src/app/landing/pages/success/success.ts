import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-success',
  imports: [CommonModule],
  templateUrl: './success.html',
  styleUrl: './success.css',
})
export class Success {
  constructor(private router: Router) { }

  irAlInicio() {
    this.router.navigate(['/landing']);
  }
}
