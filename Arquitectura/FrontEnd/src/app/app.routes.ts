import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Login } from './auth/containers/login/login';
import { Register } from './auth/containers/register/register';
import { Breadcrumbs } from './pages/breadcrumbs/breadcrumbs';
import { Nosotros } from './pages/nosotros/nosotros';
import { Recursos } from './pages/recursos/recursos';
import { Contacto } from './pages/contacto/contacto';
import { Pagos } from './pages/pagos/pagos';
import { Error404 } from './pages/error-404/error-404';
import { Menu } from './admin/template/menu/menu';
import { Inicio } from './admin/pages/inicio/inicio';
import { Usuarios } from './admin/pages/usuarios/usuarios';
import { Perfil } from './admin/template/perfil/perfil';
import { Acompanantes } from './admin/pages/acompanantes/acompanantes';
import { AcompananteDetalle } from './admin/pages/acompanantes/acompanante-detalle/acompanante-detalle';
import { Pacientes } from './admin/pages/pacientes/pacientes';
import { PacienteDetalle } from './admin/pages/pacientes/paciente-detalle/paciente-detalle';
import { Medicos } from './admin/pages/medicos/medicos';
import { MedicoDetalle } from './admin/pages/medicos/medico-detalle/medico-detalle';
import { Notificaciones } from './admin/template/notificaciones/notificaciones';
import { Success } from './pages/success/success';
import { Citas } from './admin/pages/citas/citas';
import { CitaDetalle } from './admin/pages/citas/cita-detalle/cita-detalle';
import { Tratamientos } from './admin/pages/tratamientos/tratamientos';
import { TratamientoDetalle } from './admin/pages/tratamientos/tratamiento-detalle/tratamiento-detalle';
import { Medicamentos } from './admin/pages/medicamentos/medicamentos';
import { MedicamentoDetalle } from './admin/pages/medicamentos/medicamento-detalle/medicamento-detalle';
import { Dispositivos } from './admin/pages/dispositivos/dispositivos';
import { DispositivoDetalle } from './admin/pages/dispositivos/dispositivo-detalle/dispositivo-detalle';
import { Configuracion } from './admin/pages/configuracion/configuracion';
import { MonitoreoPresion } from './admin/pages/monitoreo-presion/monitoreo-presion';

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
    path: 'breadcrumbs',
    component: Breadcrumbs,
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
    path: 'monitoreo-presion',
    component: MonitoreoPresion
  },
  {
    path: '**',
    component: Error404
  }
];
