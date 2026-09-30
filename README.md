# 🩺 HTAS — Health Tracking & Assistance System

> Sistema de monitoreo y seguimiento de hipertensión arterial que integra inteligencia artificial, conectividad Bluetooth con dispositivos médicos y gestión clínica completa.

[![Angular](https://img.shields.io/badge/Angular-21-red?logo=angular)](https://angular.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=nodedotjs)](https://nodejs.org)
[![FastAPI](https://img.shields.io/badge/Python-FastAPI-blue?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## 📋 Tabla de Contenidos

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Configuración](#instalación-y-configuración)
- [Ejecución](#ejecución)
- [Módulos del Sistema](#módulos-del-sistema)
- [API Endpoints](#api-endpoints)
- [Despliegue](#despliegue)
- [Contribuidores](#contribuidores)

---

## 📖 Descripción del Proyecto

**HTAS** es una plataforma web diseñada para el monitoreo continuo de pacientes con hipertensión arterial. El sistema permite:

- 📊 **Registro y seguimiento** de mediciones de presión arterial vía Bluetooth (baumanómetro)
- 🤖 **Análisis clínico con IA** — algoritmo de Machine Learning (XGBoost) entrenado con datos de hipertensión arterial en México
- 👨‍⚕️ **Gestión clínica** — citas, tratamientos, medicamentos, expedientes digitales
- 👨‍👩‍👧 **Roles de usuario** — Paciente, Doctor, Acompañante, Administrador
- 📱 **Interfaz responsiva** — compatible con dispositivos móviles y desktop
- 💳 **Pagos integrados** — Stripe para suscripciones

---

## 🏗️ Arquitectura del Sistema

```
HTAS/
├── Arquitectura/
│   ├── Backend/          # API REST — Node.js + Express + Python/FastAPI
│   └── FrontEnd/         # Aplicación web — Angular 21 (SSR)
└── Metodologia/          # Documentación de metodología y arquitectura
```

**Flujo de comunicación:**
```
[Usuario]
    │
    ▼
[Angular 21 — Firebase Hosting]
    │
    ▼
[Node.js/Express — Vercel]   ──▶  [PostgreSQL — Neon]
    │
    ▼
[FastAPI (Python) — Vercel]  ──▶  [Modelo ML (XGBoost)]
```

---

## 🛠️ Tecnologías Utilizadas

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| Angular | 21 | Framework principal + SSR |
| Angular Fire | 20 | Autenticación Firebase |
| Bootstrap | 5.3 | UI/estilos |
| Chart.js | 4 | Gráficas de mediciones |
| Three.js | 0.182 | Animaciones 3D landing |
| GSAP | 3.15 | Animaciones UI |
| Stripe.js | 9 | Pagos en línea |
| SweetAlert2 | 11 | Alertas y modales |

### Backend — Node.js
| Tecnología | Versión | Uso |
|---|---|---|
| Express | 5 | Framework API REST |
| PostgreSQL (pg) | 8 | Base de datos relacional |
| JSON Web Token | 9 | Autenticación JWT |
| bcrypt | 6 | Hash de contraseñas |
| Nodemailer | 8 | Envío de correos |
| Multer | 2 | Subida de archivos |
| Stripe | 21 | Pagos |
| GoogleAPIs | 173 | Integración Google Fit |

### Backend — Python/FastAPI
| Tecnología | Versión | Uso |
|---|---|---|
| FastAPI | 0.104.1 | Microservicio IA |
| XGBoost | 2.0.1 | Modelo de clasificación |
| scikit-learn | 1.3.1 | Preprocesamiento ML |
| pandas / numpy | 2 / 1.24 | Procesamiento de datos |
| pypdf | 3.17.4 | Lectura de PDFs clínicos |
| Uvicorn | 0.24 | Servidor ASGI |

---

## ✅ Requisitos Previos

Asegúrate de tener instalado:

| Herramienta | Versión mínima | Verificar con |
|---|---|---|
| Node.js | 20 LTS | `node --version` |
| npm | 10 | `npm --version` |
| Python | 3.10+ | `python --version` |
| Angular CLI | 21 | `ng version` |
| Git | 2.x | `git --version` |

Servicios en la nube requeridos (variables de entorno):
- **PostgreSQL** — Neon.tech (o instancia local)
- **Firebase** — proyecto con Authentication habilitada
- **Stripe** — cuenta de desarrollo (para pagos)
- **Vercel** — cuenta para deploy del backend

> **Nota de seguridad**: No es necesaria ninguna credencial para revisar el código fuente.
> Las credenciales de producción se configuran como variables de entorno y **nunca** deben ser commiteadas.

---

## ⚙️ Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/<tu-usuario>/HTAS.git
cd HTAS
```

### 2. Configurar el Backend (Node.js)

```bash
cd Arquitectura/Backend
npm install
cp .env.example .env
```

Edita el archivo `.env` con tus valores locales (ver sección [Variables de Entorno](#variables-de-entorno)).

### 3. Configurar el Microservicio Python (FastAPI)

```bash
cd Arquitectura/Backend/python/algorithm
pip install -r requirements.txt
```

### 4. Configurar el Frontend (Angular)

```bash
cd Arquitectura/FrontEnd
npm install
```

Crea el archivo `src/environments/environment.ts` basándote en `environment.example.ts`.

---

## 🔑 Variables de Entorno

Crea el archivo `Arquitectura/Backend/.env` con la siguiente plantilla:

```env
# Servidor
PORT=3000
NODE_ENV=development
ALLOW_DEV_ENDPOINTS=true

# Base de datos PostgreSQL
DATABASE_URL=postgresql://usuario:password@host:5432/htas_db

# Autenticación JWT
JWT_SECRET=tu_clave_secreta_jwt_muy_larga_y_segura

# Microservicio Python
URL_FASTAPI=http://127.0.0.1:8000

# Correo electrónico (Gmail App Password)
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_app_password_de_gmail

# Stripe (pagos)
STRIPE_SECRET_KEY=sk_test_tu_clave_stripe

# Google OAuth / Google Fit
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Firebase Admin (solo si se usa en backend)
FIREBASE_PROJECT_ID=tu_proyecto
```

> ⚠️ **Nunca** subas el archivo `.env` al repositorio. Ya está en `.gitignore`.

---

## ▶️ Ejecución

### Modo Desarrollo (local completo)

Necesitas **3 terminales** simultáneas:

**Terminal 1 — Microservicio Python (FastAPI):**
```bash
cd Arquitectura/Backend/python/algorithm
uvicorn hipertension_analyzer:app --reload --port 8000
```
✅ Disponible en: `http://127.0.0.1:8000`
✅ Swagger UI: `http://127.0.0.1:8000/docs`

**Terminal 2 — Backend Node.js:**
```bash
cd Arquitectura/Backend
npm run dev
```
✅ Disponible en: `http://localhost:3000`

**Terminal 3 — Frontend Angular:**
```bash
cd Arquitectura/FrontEnd
npm start
```
✅ Disponible en: `http://localhost:4200`

### Verificación rápida

```bash
# Verificar API REST
curl http://localhost:3000

# Verificar FastAPI
curl http://localhost:8000/docs
```

---

## 📦 Módulos del Sistema

| Módulo | Ruta API | Descripción |
|---|---|---|
| Autenticación | `/api/auth` | Login, registro, recuperación de contraseña |
| Usuarios | `/api/usuarios` | Gestión de perfiles por rol |
| Citas | `/api/citas` | Agendado de citas médicas |
| Mediciones | `/api/mediciones` | Registro de presión arterial |
| Medicamentos | `/api/medicamentos` | Catálogo de medicamentos |
| Tratamientos | `/api/tratamientos` | Planes de tratamiento |
| Tomas | `/api/tomas` | Registro de toma de medicamentos |
| Dispositivos | `/api/dispositivos` | Baumanómetros Bluetooth |
| Solicitudes | `/api/solicitudes` | Relación acompañante-paciente |
| Asignaciones | `/api/asignaciones` | Asignación doctor-paciente |
| Algoritmo IA | `/api/algorithm` | Análisis clínico con XGBoost |
| Pagos | `/api/pagos` | Integración Stripe |
| Contacto | `/api/contacto` | Formulario de contacto |
| Google Fit | `/api/googlefit` | Sincronización con Google Fit |

---

## 🚀 Despliegue en Producción

### Backend → Vercel

```bash
cd Arquitectura/Backend
npx vercel --prod
```

Las variables de entorno se configuran desde el panel de Vercel (no en `.env`).

### Frontend → Firebase Hosting

```bash
cd Arquitectura/FrontEnd
ng build --configuration production
firebase deploy
```

---

## 👥 Contribuidores

| Nombre | Rol | Contacto |
|---|---|---|
| Zahid Monraga Contreras | Desarrollador Principal | — |

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

*Proyecto desarrollado como parte de la carrera de Ingeniería en Desarrollo y Gestión de Software (IDGS) — 2026.*
