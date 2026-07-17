import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StripeService {

  private stripePromise = loadStripe(environment.stripePublicKey);
  private apiUrl = environment.checkoutApi;

  constructor(private http: HttpClient) { }

  async redirectToCheckout(plan: 'PRO' | 'BASIC', userId: string) {
    try {
      const response: any = await this.http.post<{ url: string }>(this.apiUrl, {
        uid: userId,
        planType: plan
      }).toPromise();

      if (response && response.url) {
        window.location.href = response.url;
      } else {
        alert('Error al procesar el pago. Intenta nuevamente.');
      }
    } catch (error: any) {
      console.error('Error al conectar con el servidor:', error);
      alert(error.error?.error || 'Error al conectar con el servidor. ¿Está encendido el Backend?');
    }
  }
}