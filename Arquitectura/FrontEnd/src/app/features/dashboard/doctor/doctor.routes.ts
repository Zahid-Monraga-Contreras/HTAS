import { Routes } from '@angular/router';
import { authGuard } from '../../../core/guards/auth.guard';
import { roleGuard } from '../../../core/guards/role.guard';

// Template
import { DoctorMenu } from './template/menu/menu';
import { DoctorNotificaciones } from './template/notificaciones/notificaciones';
import { DoctorPerfil } from './template/perfil/perfil';

// Pages
import { DoctorInicio } from './pages/inicio/inicio';
import { DoctorPacientes } from './pages/pacientes/pacientes';
import { DoctorPacienteDetalle } from './pages/pacientes/paciente-detalle/paciente-detalle';
import { DoctorCitas } from './pages/citas/citas';
import { DoctorCitaDetalle } from './pages/citas/cita-detalle/cita-detalle';
import { DoctorNuevaCita } from './pages/citas/nueva-cita/nueva-cita';
import { DoctorTratamientos } from './pages/tratamientos/tratamientos';
import { DoctorTratamientoDetalle } from './pages/tratamientos/tratamiento-detalle/tratamiento-detalle';
import { DoctorNuevoTratamiento } from './pages/tratamientos/nuevo-tratamiento/nuevo-tratamiento';
import { DoctorMedicamentos } from './pages/medicamentos/medicamentos';
import { DoctorMedicamentoDetalle } from './pages/medicamentos/medicamento-detalle/medicamento-detalle';
import { DoctorNuevoMedicamento } from './pages/medicamentos/nuevo-medicamento/nuevo-medicamento';
import { DoctorDispositivos } from './pages/dispositivos/dispositivos';
import { DoctorDispositivoDetalle } from './pages/dispositivos/dispositivo-detalle/dispositivo-detalle';
import { DoctorNuevoDispositivo } from './pages/dispositivos/nuevo-dispositivo/nuevo-dispositivo';

export const DOCTOR_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['doctor', 'Doctor', 'médico', 'medico'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full' },

            // Template
            { path: 'perfil', component: DoctorPerfil },
            { path: 'notificaciones', component: DoctorNotificaciones },

            // Páginas principales
            { path: 'inicio', component: DoctorInicio },

            // Pacientes
            { path: 'pacientes', component: DoctorPacientes },
            { path: 'pacientes/detalle/:id', component: DoctorPacienteDetalle },

            // Citas
            { path: 'citas', component: DoctorCitas },
            { path: 'citas/detalle/:id', component: DoctorCitaDetalle },
            { path: 'citas/nueva', component: DoctorNuevaCita },

            // Tratamientos
            { path: 'tratamientos', component: DoctorTratamientos },
            { path: 'tratamientos/detalle/:id', component: DoctorTratamientoDetalle },
            { path: 'tratamientos/nuevo', component: DoctorNuevoTratamiento },

            // Medicamentos
            { path: 'medicamentos', component: DoctorMedicamentos },
            { path: 'medicamentos/detalle/:id', component: DoctorMedicamentoDetalle },
            { path: 'medicamentos/nuevo', component: DoctorNuevoMedicamento },

            // Dispositivos
            { path: 'dispositivos', component: DoctorDispositivos },
            { path: 'dispositivos/detalle/:id', component: DoctorDispositivoDetalle },
            { path: 'dispositivos/nuevo', component: DoctorNuevoDispositivo },
        ]
    }
];