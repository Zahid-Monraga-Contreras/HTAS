# Variables de Entorno — Frontend Angular HTAS
# Copia este archivo como src/environments/environment.ts para desarrollo
# y como environment.production.ts para producción

## Estructura del archivo environment.ts

```typescript
export const environment = {
  production: false,

  // URL base de la API REST (Node.js Backend)
  // En desarrollo: http://localhost:3000/api
  // En producción: https://tu-backend.vercel.app/api
  apiUrl: 'http://localhost:3000/api',

  // Configuración Firebase
  firebaseConfig: {
    apiKey: 'TU_FIREBASE_API_KEY',
    authDomain: 'tu-proyecto.firebaseapp.com',
    projectId: 'tu-proyecto-id',
    storageBucket: 'tu-proyecto.appspot.com',
    messagingSenderId: 'TU_SENDER_ID',
    appId: 'TU_APP_ID',
    measurementId: 'G-XXXXXXXXXX'
  },

  // Stripe (clave pública — no secreta)
  stripePublicKey: 'pk_test_TU_STRIPE_PUBLIC_KEY',

  // reCAPTCHA (clave de sitio)
  recaptchaSiteKey: 'TU_RECAPTCHA_SITE_KEY',

  // EmailJS
  emailjsServiceId: 'TU_EMAILJS_SERVICE_ID',
  emailjsTemplateId: 'TU_EMAILJS_TEMPLATE_ID',
  emailjsPublicKey: 'TU_EMAILJS_PUBLIC_KEY',
};
```

## Dónde obtener cada valor

| Variable | Fuente |
|---|---|
| `firebaseConfig.*` | console.firebase.google.com → Configuración del proyecto → Tus apps |
| `stripePublicKey` | dashboard.stripe.com → Developers → API Keys → Publishable key |
| `recaptchaSiteKey` | console.cloud.google.com → reCAPTCHA |
| `emailjsServiceId` | dashboard.emailjs.com → Email Services |
| `emailjsPublicKey` | dashboard.emailjs.com → Account → API Keys |

> ⚠️ Los archivos `environment.ts` y `environment.production.ts` están en `.gitignore`.
> Solo las claves **públicas** (Stripe pk_test_, Firebase config) pueden ir en el frontend.
> Nunca pongas claves secretas en el código Angular.
