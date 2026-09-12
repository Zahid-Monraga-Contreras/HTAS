/**
 * Interfaces relacionadas con el flujo de pago (Stripe Checkout).
 * Consolidado a partir de StripeService.
 */

export type PlanSuscripcion = 'PRO' | 'BASIC';

/** Payload enviado al backend para iniciar un checkout de Stripe */
export interface CheckoutRequest {
    uid: string;
    planType: PlanSuscripcion;
}

/** Respuesta del backend al iniciar un checkout de Stripe */
export interface CheckoutResponse {
    url: string;
}