import { Routes } from '@angular/router';
import { Inicio } from './pages/inicio/inicio';
import { Usuarios } from './pages/usuarios/usuarios';
import { Perfil } from './template/perfil/perfil';
import { Acompanantes } from './pages/acompanantes/acompanantes';
import { AcompananteDetalle } from './pages/acompanantes/acompanante-detalle/acompanante-detalle';
import { Pacientes } from './pages/pacientes/pacientes';
import { PacienteDetalle } from './pages/pacientes/paciente-detalle/paciente-detalle';
import { Medicos } from './pages/medicos/medicos';
import { MedicoDetalle } from './pages/medicos/medico-detalle/medico-detalle';
import { Notificaciones } from './template/notificaciones/notificaciones';
import { Citas } from './pages/citas/citas';
import { CitaDetalle } from './pages/citas/cita-detalle/cita-detalle';
import { Tratamientos } from './pages/tratamientos/tratamientos';
import { TratamientoDetalle } from './pages/tratamientos/tratamiento-detalle/tratamiento-detalle';
import { Medicamentos } from './pages/medicamentos/medicamentos';
import { MedicamentoDetalle } from './pages/medicamentos/medicamento-detalle/medicamento-detalle';
import { Dispositivos } from './pages/dispositivos/dispositivos';
import { DispositivoDetalle } from './pages/dispositivos/dispositivo-detalle/dispositivo-detalle';
import { Configuracion } from './pages/configuracion/configuracion';
import { Solicitudes } from './pages/solicitudes/solicitudes';
import { authGuard } from '../../../core/guards/auth.guard';
import { roleGuard } from '../../../core/guards/role.guard';
import { AdminAsignacion } from './pages/asignacion/asignacion';

export const ADMIN_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['admin'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full', title: 'HTAS - Inicio' },
            { path: 'inicio', component: Inicio, title: 'HTAS - Inicio' },
            { path: 'usuarios', component: Usuarios, title: 'HTAS - Usuarios' },
            { path: 'perfil', component: Perfil, title: 'HTAS - Perfil' },
            { path: 'acompanantes', component: Acompanantes, title: 'HTAS - Acompañantes' },
            { path: 'acompanantes/editar/:id', component: AcompananteDetalle, title: 'HTAS - Detalle de Acompañante' },
            { path: 'pacientes', component: Pacientes, title: 'HTAS - Pacientes' },
            { path: 'pacientes/editar/:id', component: PacienteDetalle, title: 'HTAS - Detalle de Paciente' },
            { path: 'medicos', component: Medicos, title: 'HTAS - Médicos' },
            { path: 'medicos/editar/:id', component: MedicoDetalle, title: 'HTAS - Detalle de Médico' },
            { path: 'citas', component: Citas, title: 'HTAS - Citas' },
            { path: 'citas/editar/:id', component: CitaDetalle, title: 'HTAS - Detalle de Cita' },
            { path: 'tratamientos', component: Tratamientos, title: 'HTAS - Tratamientos' },
            { path: 'tratamientos/editar/:id', component: TratamientoDetalle, title: 'HTAS - Detalle de Tratamiento' },
            { path: 'medicamentos', component: Medicamentos, title: 'HTAS - Medicamentos' },
            { path: 'medicamentos/editar/:id', component: MedicamentoDetalle, title: 'HTAS - Detalle de Medicamento' },
            { path: 'dispositivos', component: Dispositivos, title: 'HTAS - Dispositivos' },
            { path: 'dispositivos/editar/:id', component: DispositivoDetalle, title: 'HTAS - Detalle de Dispositivo' },
            { path: 'notificaciones', component: Notificaciones, title: 'HTAS - Notificaciones' },
            { path: 'configuracion', component: Configuracion, title: 'HTAS - Configuración' },
            { path: 'solicitudes', component: Solicitudes, title: 'HTAS - Solicitudes' },
            { path: 'asignacion', component: AdminAsignacion, title: 'HTAS - Asignación' },
        ]
    }
];