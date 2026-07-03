import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { Users } from '../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, Chart, registerables } from 'chart.js';

// REGISTRO GLOBAL DE COMPONENTES DE CHART.JS (Soluciona el error de "linear" is not a registered scale)
Chart.register(...registerables);

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, Menu, BaseChartDirective],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit {
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  isLoading = true;

  // Los contadores globales siguen sumando TODO el universo de usuarios
  metrics = {
    totalUsuarios: 0,
    totalPacientes: 0,
    totalMedicos: 0,
    totalAcompanantes: 0
  };

  citasRecientes: any[] = [];
  medicamentosControl: any[] = [];

  // ESTRUCTURAS REACTIVAS PARA LAS GRÁFICAS (CHART.JS)
  public medicamentosChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Fármacos en Catálogo', backgroundColor: '#b0001e' }]
  };

  public usuariosChartData: ChartData<'doughnut'> = {
    labels: ['Pacientes', 'Médicos', 'Acompañantes'],
    datasets: [{ data: [0, 0, 0], backgroundColor: ['#0d6efd', '#198754', '#0dcaf0'] }]
  };

  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
  };

  public doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
  };

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      this.isLoading = true;

      const sesionGuardada = localStorage.getItem('user_htas');
      const usuarioLogueado = sesionGuardada ? JSON.parse(sesionGuardada) : null;
      const correoUsuario = usuarioLogueado?.correo || '';

      const [usuarios, citas, medicamentos] = await Promise.all([
        firstValueFrom(this.usersService.getUsuariosBackend()),
        correoUsuario ? firstValueFrom(this.usersService.getMisCitas(correoUsuario)) : Promise.resolve([]),
        firstValueFrom(this.usersService.getMedicamentos())
      ]);

      // 1. Clasificación dinámica de usuarios por Rol (Métricas Globales)
      if (Array.isArray(usuarios)) {
        this.metrics.totalUsuarios = usuarios.length;
        this.metrics.totalPacientes = usuarios.filter((u: any) => u.rol?.toLowerCase() === 'paciente').length;
        this.metrics.totalMedicos = usuarios.filter((u: any) => u.rol?.toLowerCase() === 'medico' || u.rol?.toLowerCase() === 'doctor').length;
        this.metrics.totalAcompanantes = usuarios.filter((u: any) => u.rol?.toLowerCase() === 'acompanante' || u.rol?.toLowerCase() === 'acompañante').length;

        this.usuariosChartData = {
          labels: ['Pacientes', 'Médicos', 'Acompañantes'],
          datasets: [{
            data: [this.metrics.totalPacientes, this.metrics.totalMedicos, this.metrics.totalAcompanantes],
            backgroundColor: ['#0d6efd', '#198754', '#0dcaf0']
          }]
        };
      }

      // 2. Agenda de Citas Activas - LIMITADO A LAS ÚLTIMAS 3 REGISTRADAS
      if (Array.isArray(citas)) {
        const citasMapeadas = citas.map((c: any) => {
          let fechaFormateada = 'Sin fecha';

          if (c.fechacita) {
            try {
              const fechaISO = c.fechacita.includes('T') ? c.fechacita.split('T')[0] : c.fechacita;
              const partes = fechaISO.split('-');

              if (partes.length === 3) {
                fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
              } else {
                fechaFormateada = c.fechacita;
              }
            } catch (e) {
              console.error("Error al formatear la fecha:", e);
              fechaFormateada = c.fechacita;
            }
          }

          return {
            id: c.idcita,
            fecha: fechaFormateada,
            hora: c.horacita ? c.horacita.substring(0, 5) : 'S/H',
            motivo: c.motivo || 'Consulta Médica General',
            modalidad: c.modalidad || 'Presencial',
            paciente: `${c.nombrepaciente || ''} ${c.appaternopaciente || ''}`.trim() || 'Paciente HTAS',
            estado: c.estado || 'Programada'
          };
        });

        // .slice(-3) extrae los últimos 3 elementos. .reverse() los muestra ordenados del más nuevo al más antiguo.
        this.citasRecientes = citasMapeadas.slice(-3).reverse();
      }

      // 3. Procesamiento y Limpieza de Fármacos (Catálogo e Inventario)
      if (Array.isArray(medicamentos)) {
        const todosLosMedicamentos = medicamentos.map((m: any) => ({
          nombre: m.nombreComercial || m.nombrecomercial || 'Medicamento Sin Nombre',
          sustancia: m.sustanciaActiva || m.sustanciaactiva || 'N/A',
          presentacion: m.presentacion || 'General',
          concentracion: m.concentracion || ''
        }));

        // Desglose Técnico de Fármacos: Extraemos solo los últimos 5 del registro general
        this.medicamentosControl = todosLosMedicamentos.slice(-5).reverse();

        // Agrupación de sustancias para la gráfica de barras
        const conteoSustancias: { [key: string]: number } = {};
        todosLosMedicamentos.forEach(m => {
          conteoSustancias[m.sustancia] = (conteoSustancias[m.sustancia] || 0) + 1;
        });

        // Gráfica de Control de Medicamentos en Inventario: Tomamos únicamente las últimas 5 sustancias cargadas
        const clavesSustancias = Object.keys(conteoSustancias);
        const valoresSustancias = Object.values(conteoSustancias);

        // Limitamos los labels y la data a los últimos 5 para que la gráfica no genere barras microscópicas
        const ultimasEtiquetas = clavesSustancias.slice(-5);
        const ultimosValores = valoresSustancias.slice(-5);

        this.medicamentosChartData = {
          labels: ultimasEtiquetas,
          datasets: [{
            label: 'Cantidad Registrada',
            data: ultimosValores,
            backgroundColor: '#b0001e',
            borderRadius: 6
          }]
        };
      }

    } catch (error) {
      console.error("Error al sincronizar datos reales en la vista de Inicio:", error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  getEstadoClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'confirmada':
      case 'activa':
      case 'programada':
        return 'badge-success';
      case 'pendiente':
        return 'badge-warning';
      case 'cancelada':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  }
}