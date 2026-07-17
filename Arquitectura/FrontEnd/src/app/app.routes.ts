import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing/landing';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Nosotros } from './features/landing/pages/nosotros/nosotros';
import { Recursos } from './features/landing/pages/recursos/recursos';
import { Contacto } from './features/landing/pages/contacto/contacto';
import { Pagos } from './features/landing/pages/pagos/pagos';
import { Error404 } from './features/landing/pages/error-404/error-404';
import { Menu } from './features/admin/template/menu/menu';
import { Inicio } from './features/admin/pages/inicio/inicio';
import { Usuarios } from './features/admin/pages/usuarios/usuarios';
import { Perfil } from './features/admin/template/perfil/perfil';
import { Acompanantes } from './features/admin/pages/acompanantes/acompanantes';
import { AcompananteDetalle } from './features/admin/pages/acompanantes/acompanante-detalle/acompanante-detalle';
import { Pacientes } from './features/admin/pages/pacientes/pacientes';
import { PacienteDetalle } from './features/admin/pages/pacientes/paciente-detalle/paciente-detalle';
import { Medicos } from './features/admin/pages/medicos/medicos';
import { MedicoDetalle } from './features/admin/pages/medicos/medico-detalle/medico-detalle';
import { Notificaciones } from './features/admin/template/notificaciones/notificaciones';
import { Success } from './features/landing/pages/success/success';
import { Citas } from './features/admin/pages/citas/citas';
import { CitaDetalle } from './features/admin/pages/citas/cita-detalle/cita-detalle';
import { Tratamientos } from './features/admin/pages/tratamientos/tratamientos';
import { TratamientoDetalle } from './features/admin/pages/tratamientos/tratamiento-detalle/tratamiento-detalle';
import { Medicamentos } from './features/admin/pages/medicamentos/medicamentos';
import { MedicamentoDetalle } from './features/admin/pages/medicamentos/medicamento-detalle/medicamento-detalle';
import { Dispositivos } from './features/admin/pages/dispositivos/dispositivos';
import { DispositivoDetalle } from './features/admin/pages/dispositivos/dispositivo-detalle/dispositivo-detalle';
import { Configuracion } from './features/admin/pages/configuracion/configuracion';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/landing'
  },
  {
    path: 'landing',
    component: Landing,
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'register',
    component: Register,
  },
  {
    path: 'nosotros',
    component: Nosotros,
  },
  {
    path: 'recursos',
    component: Recursos,
  },
  {
    path: 'contactos',
    component: Contacto,
  },
  {
    path: 'success',
    component: Success,
  },
  {
    path: 'pagos',
    component: Pagos,
  },
  {
    path: 'admin',
    component: Menu,
  },
  {
    path: 'inicio',
    component: Inicio
  },
  {
    path: 'usuarios',
    component: Usuarios
  },
  {
    path: 'medicos',
    component: Medicos
  },
  {
    path: 'medicos/editar/:id',
    component: MedicoDetalle
  },
  {
    path: 'pacientes',
    component: Pacientes
  },
  {
    path: 'pacientes/editar/:id',
    component: PacienteDetalle
  },
  {
    path: 'acompanantes',
    component: Acompanantes
  },
  {
    path: 'acompanantes/editar/:id',
    component: AcompananteDetalle
  },
  {
    path: 'citas',
    component: Citas
  },
  {
    path: 'citas/editar/:id',
    component: CitaDetalle
  },
  {
    path: 'tratamientos',
    component: Tratamientos
  },
  {
    path: 'tratamientos/editar/:id',
    component: TratamientoDetalle
  },
  {
    path: 'medicamentos',
    component: Medicamentos
  },
  {
    path: 'medicamentos/editar/:id',
    component: MedicamentoDetalle
  },
  {
    path: 'dispositivos',
    component: Dispositivos
  },
  {
    path: 'dispositivos/editar/:id',
    component: DispositivoDetalle
  },
  {
    path: 'perfil',
    component: Perfil
  },
  {
    path: 'notificaciones',
    component: Notificaciones
  },
  {
    path: 'configuracion',
    component: Configuracion
  },
  {
    path: '**',
    component: Error404
  }
];
