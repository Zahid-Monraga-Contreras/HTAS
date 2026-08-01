import { Routes } from '@angular/router';
import { authGuard } from '../../../core/guards/auth.guard';
import { roleGuard } from '../../../core/guards/role.guard';

// Template
import { CaregiverMenu } from './template/menu/menu';
import { CaregiverNotificaciones } from './template/notificaciones/notificaciones';
import { CaregiverPerfil } from './template/perfil/perfil';

// Pages
import { CaregiverInicio } from './pages/inicio/inicio';
import { CaregiverPacientes } from './pages/pacientes/pacientes';
import { CaregiverPacienteDetalle } from './pages/pacientes/paciente-detalle/paciente-detalle';
import { CaregiverCitas } from './pages/citas/citas';
import { CaregiverCitaDetalle } from './pages/citas/cita-detalle/cita-detalle';
import { CaregiverTratamientos } from './pages/tratamientos/tratamientos';
import { CaregiverTratamientoDetalle } from './pages/tratamientos/tratamiento-detalle/tratamiento-detalle';
import { CaregiverMedicamentos } from './pages/medicamentos/medicamentos';
import { CaregiverMedicamentoDetalle } from './pages/medicamentos/medicamento-detalle/medicamento-detalle';
import { CaregiverDispositivos } from './pages/dispositivos/dispositivos';
import { CaregiverDispositivoDetalle } from './pages/dispositivos/dispositivo-detalle/dispositivo-detalle';

export const CAREGIVER_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['acompañante', 'caregiver', 'Acompañante'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full' },
            { path: 'perfil', component: CaregiverPerfil },
            { path: 'notificaciones', component: CaregiverNotificaciones },
            { path: 'inicio', component: CaregiverInicio },
            { path: 'pacientes', component: CaregiverPacientes },
            { path: 'pacientes/detalle/:id', component: CaregiverPacienteDetalle },
            { path: 'citas', component: CaregiverCitas },
            { path: 'citas/detalle/:id', component: CaregiverCitaDetalle },
            { path: 'tratamientos', component: CaregiverTratamientos },
            { path: 'tratamientos/detalle/:id', component: CaregiverTratamientoDetalle },
            { path: 'medicamentos', component: CaregiverMedicamentos },
            { path: 'medicamentos/detalle/:id', component: CaregiverMedicamentoDetalle },
            { path: 'dispositivos', component: CaregiverDispositivos },
            { path: 'dispositivos/detalle/:id', component: CaregiverDispositivoDetalle },
        ]
    }
];