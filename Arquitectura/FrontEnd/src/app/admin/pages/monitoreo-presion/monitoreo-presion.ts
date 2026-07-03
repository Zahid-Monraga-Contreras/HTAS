import { Component, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AnalisisIA, BloodPressure } from '../../../auth/services/blood-pressure';
import { Htas, RespuestaHTAS } from '../../../auth/services/htas';
import { Menu } from "../../template/menu/menu";

@Component({
  selector: 'app-monitoreo-presion',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './monitoreo-presion.html',
  styleUrl: './monitoreo-presion.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Permite el uso de etiquetas personalizadas como box-icon
})
export class MonitoreoPresion {
  sistolica!: number;
  diastolica!: number;
  pulso!: number;
  tomaMedicamento: number = 1; // Guarda 1 (Sí) o 0 (No) para el algoritmo predictivo

  resultadoIA: AnalisisIA | null = null;
  resultadoAlgoritmo: RespuestaHTAS['resultado'] | null = null;
  cargando: boolean = false;
  errorMensaje: string | null = null;

  // Edad base asignada para el cálculo del algoritmo local
  edadPaciente: number = 55;

  constructor(
    private bpService: BloodPressure,
    private htas: Htas,
    private cdr: ChangeDetectorRef
  ) { }

  procesarLectura() {
    // Validar campos vacíos
    if (!this.sistolica || !this.diastolica || !this.pulso) {
      this.errorMensaje = 'Por favor, completa todos los campos del formulario.';
      return;
    }

    // Validar consistencia clínica básica
    if (this.sistolica <= this.diastolica) {
      this.errorMensaje = 'Error clínico: La presión sistólica debe ser estrictamente mayor a la diastólica.';
      return;
    }

    this.cargando = true;
    this.errorMensaje = null;
    this.resultadoIA = null;
    this.resultadoAlgoritmo = null;
    this.cdr.detectChanges();

    // Consultas simultáneas con RxJS hacia Ollama (bpService) y XGBoost (htasService)
    forkJoin({
      peticionOllama: this.bpService.enviarLectura(this.sistolica, this.diastolica, this.pulso),
      peticionAlgoritmo: this.htas.evaluarCrisis({
        edad: this.edadPaciente,
        sistolica: this.sistolica,
        diastolica: this.diastolica,
        tomaMedicamento: this.tomaMedicamento
      })
    }).subscribe({
      next: (responses: any) => {
        console.log('Ambas respuestas recibidas con éxito:', responses);

        // Mapeo adaptativo del modelo de texto (Ollama)
        const responseIA = responses.peticionOllama;
        this.resultadoIA = {
          estado: responseIA.estado || responseIA.Estado || 'No especificado',
          riesgo: responseIA.riesgo || responseIA.Riesgo || 'No evaluado',
          alerta: responseIA.alerta || responseIA.Alerta || 'Sin alertas registradas',
          seguimiento: responseIA.seguimiento || responseIA.Seguimiento || 'Seguimiento general',
          recomendacion: responseIA.recomendacion || responseIA.Recomendacion || 'Sin pautas específicas',
          accionMedica: responseIA.accionMedica || responseIA.AccionMedica || responseIA.accion_medica || 'Consulte preventivamente a su médico.'
        };

        // Mapeo del algoritmo XGBoost gestionado en Node.js
        if (responses.peticionAlgoritmo && responses.peticionAlgoritmo.success) {
          this.resultadoAlgoritmo = responses.peticionAlgoritmo.resultado;
        }

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error crítico combinado en la petición desde Angular:', err);

        // Atrapa respuestas personalizadas de errores clínicos
        if (err.error && err.error.error) {
          this.errorMensaje = err.error.error;
        } else {
          this.errorMensaje = 'Hubo un problema al conectar con los módulos de análisis clínico.';
        }

        this.cargando = false;
        this.resultadoIA = null;
        this.resultadoAlgoritmo = null;
        this.cdr.detectChanges();
      }
    });
  }
}