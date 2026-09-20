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
            { path: '', redirectTo: 'inicio', pathMatch: 'full', title: 'HTAS - Inicio' },
            { path: 'perfil', component: CaregiverPerfil, title: 'HTAS - Perfil' },
            { path: 'notificaciones', component: CaregiverNotificaciones, title: 'HTAS - Notificaciones' },
            { path: 'inicio', component: CaregiverInicio, title: 'HTAS - Inicio' },
            { path: 'pacientes', component: CaregiverPacientes, title: 'HTAS - Pacientes' },
            { path: 'pacientes/detalle/:id', component: CaregiverPacienteDetalle, title: 'HTAS - Detalle de Paciente' },
            { path: 'citas', component: CaregiverCitas, title: 'HTAS - Citas' },
            { path: 'citas/detalle/:id', component: CaregiverCitaDetalle, title: 'HTAS - Detalle de Cita' },
            { path: 'tratamientos', component: CaregiverTratamientos, title: 'HTAS - Tratamientos' },
            { path: 'tratamientos/detalle/:id', component: CaregiverTratamientoDetalle, title: 'HTAS - Detalle de Tratamiento' },
            { path: 'medicamentos', component: CaregiverMedicamentos, title: 'HTAS - Medicamentos' },
            { path: 'medicamentos/detalle/:id', component: CaregiverMedicamentoDetalle, title: 'HTAS - Detalle de Medicamento' },
            { path: 'dispositivos', component: CaregiverDispositivos, title: 'HTAS - Dispositivos' },
            { path: 'dispositivos/detalle/:id', component: CaregiverDispositivoDetalle, title: 'HTAS - Detalle de Dispositivo' },
        ]
    }
];