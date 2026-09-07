import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';

export const DASHBOARD_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard],
        children: [
            {
                path: 'admin',
                loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
                canActivate: [roleGuard],
                data: { roles: ['admin'] }
            },
            {
                path: 'patient',
                loadChildren: () => import('./patient/patient.routes').then(m => m.PATIENT_ROUTES),
                canActivate: [roleGuard],
                data: { roles: ['paciente'] }
            },
            {
                path: 'doctor',
                loadChildren: () => import('./doctor/doctor.routes').then(m => m.DOCTOR_ROUTES),
                canActivate: [roleGuard],
                data: { roles: ['doctor', 'médico', 'medico'] }
            },
            {
                path: 'caregiver',
                loadChildren: () => import('./caregiver/caregiver.routes').then(m => m.CAREGIVER_ROUTES),
                canActivate: [roleGuard],
                data: { roles: ['acompañante', 'caregiver'] }
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: '/dashboard/patient'
            }
        ]
    }
];