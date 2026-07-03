import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";
import { GoogleService } from '../../../../auth/services/google';
import { environment } from '../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dispositivo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './dispositivo-detalle.html',
  styleUrls: ['./dispositivo-detalle.css']
})
export class DispositivoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private googleService = inject(GoogleService);
  private http = inject(HttpClient);

  // Objeto unificado que interactúa con la vista
  dispositivoSeleccionado: any = null;
  isSaving = false;

  pacientesLista: any[] = [];
  filtroPaciente: string = '';
  mostrarDropdown = false;

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;
  ultimaMedicion: any = null;

  async ngOnInit() {
    let state: any = null;

    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    // 1. Intentar recuperar desde el estado de navegación de Angular
    if (state && state.dispositivo) {
      this.dispositivoSeleccionado = { ...state.dispositivo };
    } else {
      // 2. Recuperación de respaldo ante recargas físicas (F5) usando el ID de la URL
      const idUrl = this.route.snapshot.paramMap.get('id');

      if (idUrl) {
        try {
          const todos = await firstValueFrom(this.usersService.getDispositivos());
          const encontrado = todos?.find((d: any) =>
            String(d.iddispositivo) === String(idUrl)
          );

          if (encontrado) {
            this.dispositivoSeleccionado = { ...encontrado };
            this.cdr.detectChanges();
          } else {
            this.router.navigate(['/dispositivos']);
          }
        } catch (error) {
          console.error("Error al re-hidratar datos del dispositivo desde el servidor:", error);
          this.router.navigate(['/dispositivos']);
        }
      } else {
        this.router.navigate(['/dispositivos']);
      }
    }
    if (this.dispositivoSeleccionado?.idpaciente) {
      this.cargarUltimaMedicion(this.dispositivoSeleccionado.idpaciente);
    }

    const todosLosPacientes = await firstValueFrom(this.usersService.getUsuariosBackend());
    this.pacientesLista = todosLosPacientes.filter((u: any) => u.rol === 'paciente');

    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'success' && this.dispositivoSeleccionado?.idpaciente) {
        this.lanzarNotificacion("Vinculación exitosa con Google Fit", "success");

        // Forzamos la carga de datos inmediatamente al volver
        this.cargarDatosGoogleFit();

        // Opcional: Limpiar la URL para que no vuelva a cargar si refrescas la página
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { status: null },
          queryParamsHandling: 'merge'
        });
      }
    });
  }

  get pacientesFiltrados() {
    if (!this.filtroPaciente) return this.pacientesLista;
    const term = this.filtroPaciente.toLowerCase();
    return this.pacientesLista.filter(p => {
      const nombreCompleto = `${p.nombre || ''} ${p.appaterno || ''} ${p.apmaterno || ''}`.toLowerCase();
      return nombreCompleto.includes(term);
    });
  }

  ocultarDropdown() {
    setTimeout(() => {
      this.mostrarDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  asignarPaciente(p: any) {
    this.dispositivoSeleccionado.idpaciente = p.idusuario;
    this.dispositivoSeleccionado.nombrepaciente = p.nombre;
    this.dispositivoSeleccionado.appaternopaciente = p.appaterno;
    this.filtroPaciente = `${p.nombre} ${p.appaterno}`;
    this.mostrarDropdown = false;
  }

  async cargarUltimaMedicion(idPaciente: number) {
    try {
      const data = await firstValueFrom(this.usersService.getUltimaMedicionPaciente(idPaciente));

      // Si la API devuelve un objeto vacío, lo tratamos como null
      this.ultimaMedicion = data && Object.keys(data).length > 0 ? data : null;
      this.cdr.detectChanges();
    } catch (error) {
      console.warn("No hay mediciones previas.");
      this.ultimaMedicion = null;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  volver() {
    this.location.back();
  }

  lanzarNotificacion(mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    this.cdr.detectChanges();

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      this.mostrarToast = false;
      this.cdr.detectChanges();
    }, 4000);
  }

  async guardarCambios() {
    if (!this.dispositivoSeleccionado) return;

    // Extracción limpia del ID primario usado por el Router de Angular
    const id = this.dispositivoSeleccionado.iddispositivo;
    if (!id) {
      this.lanzarNotificacion("Error interno: No se detectó el ID del dispositivo.", "error");
      return;
    }

    const nombreLimpio = (this.dispositivoSeleccionado.nombre || '').trim();
    if (!nombreLimpio) {
      this.lanzarNotificacion("El nombre del dispositivo es obligatorio.", "warning");
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      // PAYLOAD CONTROLADO: Coincide perfectamente con las llaves que desestructura tu Express
      const payload = {
        nombre: nombreLimpio,
        direccionMac: this.dispositivoSeleccionado.direccionmac || this.dispositivoSeleccionado.direccionMac,
        // Asegúrate de usar la propiedad correcta que tiene el valor actual
        idPacienteAsociado: this.dispositivoSeleccionado.idpaciente || this.dispositivoSeleccionado.idPacienteAsociado || null,
        activo: !!this.dispositivoSeleccionado.activo
      };

      // Consumo de la petición PUT hacia la API
      const respuesta = await firstValueFrom(this.usersService.actualizarDispositivo(id, payload));

      if (respuesta.dispositivo) {
        this.dispositivoSeleccionado = { ...this.dispositivoSeleccionado, ...respuesta.dispositivo };
      }

      this.lanzarNotificacion("¡Dispositivo actualizado con éxito!", "success");

      // Redirección con retraso para lucir el Toast Premium
      setTimeout(() => {
        this.router.navigate(['/dispositivos']);
      }, 1500);

    } catch (error: any) {
      console.error("Error al actualizar la tabla de dispositivos:", error);
      const msgErr = error.error?.error || error.message || "Error al procesar la actualización.";
      this.lanzarNotificacion(`Error: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // --- Reemplaza tu método vincularGoogleFit actual por este ---

  async vincularGoogleFit() {
    // ELIMINAMOS EL IF QUE TE PIDE EL PACIENTE
    // Ahora, simplemente tomamos el ID que haya, y si no hay, pasamos 0 o null
    const idPaciente = this.dispositivoSeleccionado?.idpaciente || 0;

    // El botón ahora siempre llamará al servicio, sin bloquearte
    console.log("Intentando vincular con el ID:", idPaciente);
    await this.googleService.iniciarVinculacionGoogleFit(idPaciente);
  }

  async cargarDatosGoogleFit() {
    // Asegúrate de usar el ID correcto que tienes en memoria
    const idPaciente = this.dispositivoSeleccionado?.idpaciente;

    if (!idPaciente) {
      this.lanzarNotificacion("No hay un paciente asociado para buscar datos.", "error");
      return;
    }

    try {
      // Esta URL debe apuntar a tu backend, que es quien tiene el permiso para hablar con Google
      const url = `${environment.authApi}/google-fit/data/${idPaciente}`;

      // Hacemos la petición
      const data = await firstValueFrom(this.http.get(url));

      if (data) {
        this.ultimaMedicion = data;
        this.lanzarNotificacion("Datos obtenidos correctamente.", "success");
      } else {
        this.lanzarNotificacion("No se encontraron mediciones nuevas en Google Fit.", "warning");
      }
    } catch (error) {
      console.error("Error al obtener datos:", error);
      this.lanzarNotificacion("Error al conectar con Google Fit.", "error");
    }
  }
}