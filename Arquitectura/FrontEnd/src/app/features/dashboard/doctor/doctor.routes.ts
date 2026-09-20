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
import { DoctorAnalisis } from './pages/analisis/analisis';
import { DoctorAnalisisDetalle } from './pages/analisis/analisis-detalle/analisis-detalle';
import { DoctorAsignacion } from './pages/asignacion/asignacion';

export const DOCTOR_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['doctor', 'Doctor', 'médico', 'medico'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full', title: 'HTAS - Inicio' },

            // Template
            { path: 'perfil', component: DoctorPerfil, title: 'HTAS - Perfil' },
            { path: 'notificaciones', component: DoctorNotificaciones, title: 'HTAS - Notificaciones' },

            // Páginas principales
            { path: 'inicio', component: DoctorInicio, title: 'HTAS - Inicio' },

            // Pacientes
            { path: 'pacientes', component: DoctorPacientes, title: 'HTAS - Pacientes' },
            { path: 'pacientes/detalle/:id', component: DoctorPacienteDetalle, title: 'HTAS - Detalle de Paciente' },

            // Citas
            { path: 'citas', component: DoctorCitas, title: 'HTAS - Citas' },
            { path: 'citas/detalle/:id', component: DoctorCitaDetalle, title: 'HTAS - Detalle de Cita' },
            { path: 'citas/nueva', component: DoctorNuevaCita, title: 'HTAS - Nueva Cita' },

            // Tratamientos
            { path: 'tratamientos', component: DoctorTratamientos, title: 'HTAS - Tratamientos' },
            { path: 'tratamientos/detalle/:id', component: DoctorTratamientoDetalle, title: 'HTAS - Detalle de Tratamiento' },
            { path: 'tratamientos/nuevo', component: DoctorNuevoTratamiento, title: 'HTAS - Nuevo Tratamiento' },

            // Medicamentos
            { path: 'medicamentos', component: DoctorMedicamentos, title: 'HTAS - Medicamentos' },
            { path: 'medicamentos/detalle/:id', component: DoctorMedicamentoDetalle, title: 'HTAS - Detalle de Medicamento' },
            { path: 'medicamentos/nuevo', component: DoctorNuevoMedicamento, title: 'HTAS - Nuevo Medicamento' },

            // Dispositivos
            { path: 'dispositivos', component: DoctorDispositivos, title: 'HTAS - Dispositivos' },
            { path: 'dispositivos/detalle/:id', component: DoctorDispositivoDetalle, title: 'HTAS - Detalle de Dispositivo' },
            { path: 'dispositivos/nuevo', component: DoctorNuevoDispositivo, title: 'HTAS - Nuevo Dispositivo' },

            // Analisis
            { path: 'analisis', component: DoctorAnalisis, title: 'HTAS - Análisis' },
            { path: 'analisis/detalle/:id/:folio', component: DoctorAnalisisDetalle, title: 'HTAS - Detalle de Análisis' },

            // Asignacion
            { path: 'asignacion', component: DoctorAsignacion, title: 'HTAS - Asignación' },
        ]
    }
];