# Changelog — HTAS

Todos los cambios importantes del proyecto están documentados aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.0.0] — 2026-09-29 — Versión de Entrega Académica

### Añadido
- Sistema completo de autenticación JWT con roles (Paciente, Doctor, Acompañante, Administrador)
- Módulo de mediciones de presión arterial (manual y vía Bluetooth)
- Conectividad Bluetooth con baumanómetro — lectura automática de presión arterial
- Microservicio FastAPI con modelo XGBoost para análisis clínico de hipertensión
- Integración de análisis de PDFs médicos (cédula y diagnóstico)
- Gestión completa de citas médicas con selección de horarios por doctor
- Módulo de tratamientos y medicamentos con registro de tomas
- Gestión de asignaciones doctor-paciente con panel de administración
- Sistema de solicitudes acompañante-paciente con aprobación del administrador
- Integración de pagos con Stripe
- Formulario de contacto con envío de correo (Nodemailer/Gmail)
- Integración con Google Fit para sincronización de datos de salud
- Landing page con animaciones 3D (Three.js + GSAP)
- Frontend Angular 21 con SSR desplegado en Firebase Hosting
- Backend Node.js/Express desplegado en Vercel
- Base de datos PostgreSQL en Neon

### Correcciones aplicadas (últimos commits)
- fix: prevenir desbordamiento del nav inferior en móvil con scroll horizontal
- fix: rellenar nombre del doctor en citas del paciente (campo `medico`)
- fix(citas): mapear campos snake_case del backend al extraer `doctorId`
- refactor(citas): añadir filtro por doctor en la verificación de disponibilidad de slots
- feat(routes): añadir títulos de página a rutas de doctor, acompañante y admin
- fix(bluetooth): hacer coincidir nombre del dispositivo BLE con BleModule
- feat: añadir lectura de presión arterial por Bluetooth al backend
- feat: añadir componente frontend para lectura Bluetooth de presión arterial
- feat(device): añadir script para obtener dirección MAC del baumanómetro
- fix(vercel): redirigir tráfico `/api/algorithm` al backend Node para render

---

## [0.3.0] — Sprint 3

### Añadido
- Módulo de asignaciones y solicitudes
- Panel de administración completo
- Algoritmo de análisis IA integrado al flujo clínico
- Generación de expedientes PDF

---

## [0.2.0] — Sprint 2

### Añadido
- Módulo de citas médicas
- Módulo de medicamentos y tratamientos
- Roles de usuario diferenciados
- Dashboard específico por rol

---

## [0.1.0] — Sprint 1

### Añadido
- Estructura inicial del proyecto
- Autenticación de usuarios
- Registro de mediciones básico
- Diseño de base de datos (PostgreSQL)
- Landing page inicial
