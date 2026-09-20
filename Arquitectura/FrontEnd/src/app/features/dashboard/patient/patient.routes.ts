import { Routes } from '@angular/router';
import { authGuard } from '../../../core/guards/auth.guard';
import { roleGuard } from '../../../core/guards/role.guard';
import { PatientInicio } from './pages/inicio/inicio';
import { PatientCitas } from './pages/citas/citas';
import { PatientTratamientos } from './pages/tratamientos/tratamientos';
import { PatientMedicamentos } from './pages/medicamentos/medicamentos';
import { PatientDispositivos } from './pages/dispositivos/dispositivos';
import { PatientAnalisis } from './pages/analisis/analisis';
import { PatientPerfil } from './template/perfil/perfil';
import { PatientNotificaciones } from './template/notificaciones/notificaciones';

export const PATIENT_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['paciente'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full' },

            { path: 'inicio', component: PatientInicio, title: 'HTAS - Inicio' },
            { path: 'perfil', component: PatientPerfil, title: 'HTAS - Perfil' },
            { path: 'notificaciones', component: PatientNotificaciones, title: 'HTAS - Notificaciones' },

            { path: 'citas', component: PatientCitas, title: 'HTAS - Citas' },
            { path: 'citas/editar/:id', component: PatientCitas, title: 'HTAS - Editar Cita' },
            { path: 'citas/nueva', component: PatientCitas, title: 'HTAS - Nueva Cita' },

            { path: 'tratamientos', component: PatientTratamientos, title: 'HTAS - Tratamientos' },
            { path: 'tratamientos/detalle/:id', component: PatientTratamientos, title: 'HTAS - Detalle de Tratamiento' },

            { path: 'medicamentos', component: PatientMedicamentos, title: 'HTAS - Medicamentos' },
            { path: 'medicamentos/detalle/:id', component: PatientMedicamentos, title: 'HTAS - Detalle de Medicamento' },

            { path: 'dispositivos', component: PatientDispositivos, title: 'HTAS - Dispositivos' },
            { path: 'dispositivos/detalle/:id', component: PatientDispositivos, title: 'HTAS - Detalle de Dispositivo' },

            { path: 'analisis', component: PatientAnalisis, title: 'HTAS - Análisis' }
        ]
    }
];