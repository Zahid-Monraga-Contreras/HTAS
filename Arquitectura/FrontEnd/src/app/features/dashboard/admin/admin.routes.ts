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

export const ADMIN_ROUTES: Routes = [
    {
        path: '',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['admin'] },
        children: [
            { path: '', redirectTo: 'inicio', pathMatch: 'full' },
            { path: 'inicio', component: Inicio },
            { path: 'usuarios', component: Usuarios },
            { path: 'perfil', component: Perfil },
            { path: 'acompanantes', component: Acompanantes },
            { path: 'acompanantes/editar/:id', component: AcompananteDetalle },
            { path: 'pacientes', component: Pacientes },
            { path: 'pacientes/editar/:id', component: PacienteDetalle },
            { path: 'medicos', component: Medicos },
            { path: 'medicos/editar/:id', component: MedicoDetalle },
            { path: 'citas', component: Citas },
            { path: 'citas/editar/:id', component: CitaDetalle },
            { path: 'tratamientos', component: Tratamientos },
            { path: 'tratamientos/editar/:id', component: TratamientoDetalle },
            { path: 'medicamentos', component: Medicamentos },
            { path: 'medicamentos/editar/:id', component: MedicamentoDetalle },
            { path: 'dispositivos', component: Dispositivos },
            { path: 'dispositivos/editar/:id', component: DispositivoDetalle },
            { path: 'notificaciones', component: Notificaciones },
            { path: 'configuracion', component: Configuracion },
            { path: 'solicitudes', component: Solicitudes },
        ]
    }
];