import { Routes } from '@angular/router';
import { authGuard } from '../../../core/guards/auth.guard';
import { roleGuard } from '../../../core/guards/role.guard';
import { PatientInicio } from './pages/inicio/inicio';
import { PatientCitas } from './pages/citas/citas';
import { PatientTratamientos } from './pages/tratamientos/tratamientos';
import { PatientMedicamentos } from './pages/medicamentos/medicamentos';
import { PatientDispositivos } from './pages/dispositivos/dispositivos';
import { PatientPerfil } from './template/perfil/perfil';
import { PatientNotificaciones } from './template/notificaciones/notificaciones';

export const PATIENT_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['paciente'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full' },

            { path: 'inicio', component: PatientInicio },
            { path: 'perfil', component: PatientPerfil },
            { path: 'notificaciones', component: PatientNotificaciones },

            { path: 'citas', component: PatientCitas },
            { path: 'citas/editar/:id', component: PatientCitas },
            { path: 'citas/nueva', component: PatientCitas },

            { path: 'tratamientos', component: PatientTratamientos },
            { path: 'tratamientos/detalle/:id', component: PatientTratamientos },

            { path: 'medicamentos', component: PatientMedicamentos },
            { path: 'medicamentos/detalle/:id', component: PatientMedicamentos },

            { path: 'dispositivos', component: PatientDispositivos },
            { path: 'dispositivos/detalle/:id', component: PatientDispositivos },

        ]
    }
];