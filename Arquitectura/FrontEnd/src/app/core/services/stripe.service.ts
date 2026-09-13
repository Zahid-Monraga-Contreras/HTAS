import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment.prod';
import { timeout } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StripeService {

  private stripePromise = loadStripe(environment.stripePublicKey);
  private apiUrl = environment.checkoutApi;

  // FIX LENTITUD: sin un timeout explícito, el navegador puede tardar
  // mucho tiempo en darse por vencido esperando una respuesta del
  // backend (sobre todo si está apagado o la petición se queda
  // "colgada"). Eso hacía que el modal de error tardara en aparecer,
  // aunque su animación en sí es casi instantánea. Con este límite,
  // si el backend no responde en 8 segundos se corta la espera y se
  // lanza el error de inmediato.
  private readonly REQUEST_TIMEOUT_MS = 8000;

  constructor(private http: HttpClient) { }

  async redirectToCheckout(plan: 'PRO' | 'BASIC', userId: string) {
    try {
      // FIX: se reemplaza .toPromise() (deprecado y sin soporte nativo
      // de timeout) por firstValueFrom(...) combinado con el operador
      // timeout() de RxJS, que corta la espera si no hay respuesta a
      // tiempo.
      const response: any = await firstValueFrom(
        this.http.post<{ url: string }>(this.apiUrl, {
          uid: userId,
          planType: plan
        }).pipe(
          timeout(this.REQUEST_TIMEOUT_MS)
        )
      );

      if (response && response.url) {
        window.location.href = response.url;
      } else {
        throw new Error('Error al procesar el pago. Intenta nuevamente.');
      }
    } catch (error: any) {
      console.error('Error al conectar con el servidor:', error);

      // Si fue el timeout el que cortó la espera, damos un mensaje
      // más preciso que el genérico de "Backend apagado".
      if (error?.name === 'TimeoutError') {
        throw new Error('El servidor está tardando demasiado en responder. Verifica tu conexión e intenta de nuevo.');
      }

      throw new Error(error.error?.error || 'Error al conectar con el servidor. Por favor, verifica tu conexión o intenta más tarde.');
    }
  }
}