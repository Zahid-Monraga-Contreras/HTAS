import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-nuevo-medicamento',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, DoctorMenu],
    templateUrl: './nuevo-medicamento.html',
    styleUrls: ['./nuevo-medicamento.css']
})
export class DoctorNuevoMedicamento implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = false;
    medicamentoForm: FormGroup;
    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    constructor() {
        this.medicamentoForm = this.fb.group({
            nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
            sustanciaActiva: [''],
            presentacion: ['', [Validators.required]],
            concentracion: [''],
            laboratorio: [''],
            indicacionesGenerales: ['']
        });
    }

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
    }

    private showToast(type: ToastNotification['type'], title: string, message: string, duration: number = 5000) {
        const id = ++this.notificationCounter;
        const notification: ToastNotification = {
            id,
            type,
            title,
            message,
            duration
        };

        this.notifications.unshift(notification);
        this.cdr.detectChanges();

        setTimeout(() => {
            this.removeToast(id);
        }, duration);
    }

    removeToast(id: number) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.cdr.detectChanges();
    }

    showSuccess(title: string, message: string, duration: number = 5000) {
        this.showToast('success', title, message, duration);
    }

    showError(title: string, message: string, duration: number = 7000) {
        this.showToast('error', title, message, duration);
    }

    showWarning(title: string, message: string, duration: number = 5000) {
        this.showToast('warning', title, message, duration);
    }

    showInfo(title: string, message: string, duration: number = 4000) {
        this.showToast('info', title, message, duration);
    }

    async crearMedicamento() {
        if (this.medicamentoForm.invalid) {
            this.medicamentoForm.markAllAsTouched();
            this.showWarning('Formulario Incompleto', 'Por favor, completa todos los campos requeridos.');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        try {
            const formData = this.medicamentoForm.value;

            const datosMedicamento = {
                nombreComercial: formData.nombreComercial.trim(),
                sustanciaActiva: formData.sustanciaActiva || null,
                presentacion: formData.presentacion.trim(),
                concentracion: formData.concentracion || null,
                laboratorio: formData.laboratorio || null,
                indicacionesGenerales: formData.indicacionesGenerales || null
            };

            await firstValueFrom(this.usersService.crearMedicamento(datosMedicamento));

            this.showSuccess(
                'Medicamento Creado',
                'El medicamento ha sido creado exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/medicamentos']);
            }, 1000);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al crear el medicamento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Crear', mensajeError);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    cancelar() {
        this.router.navigate(['/doctor/medicamentos']);
    }
}