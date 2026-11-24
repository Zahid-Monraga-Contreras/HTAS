# Links del proyecto HTAS

Índice de todos los enlaces (URLs) encontrados en el proyecto HTAS, organizados por categoría.
Cada enlace incluye una descripción corta y el archivo donde aparece.

> Por seguridad, este documento **no** incluye enlaces con contraseñas, tokens, API keys,
> claves secretas ni cadenas de conexión a bases de datos.

---

## Repositorios

| Enlace | Descripción | Origen |
|---|---|---|
| https://github.com/Zahid-Monraga-Contreras/HTAS | Repositorio personal del proyecto (rama `main`) | — |
| https://github.com/utcvti-research/2526-IDGS-14-HTAS | Repositorio del profesor / institucional (UTCV) | — |

## Releases

| Enlace | Descripción | Origen |
|---|---|---|
| https://github.com/Zahid-Monraga-Contreras/HTAS/releases/tag/v1.0.0 | Versión v1.0.0 en el repositorio personal | Etiqueta `v1.0.0` |
| https://github.com/utcvti-research/2526-IDGS-14-HTAS/releases/tag/v1.0.0 | Versión v1.0.0 en el repositorio del profesor | Etiqueta `v1.0.0` |
| [releases/HTAS-v1.0.0-frontend.zip](releases/HTAS-v1.0.0-frontend.zip) | Paquete de despliegue del frontend (Angular) | `releases/README.md` |
| [releases/HTAS-v1.0.0-backend.zip](releases/HTAS-v1.0.0-backend.zip) | Paquete de despliegue del backend (Node.js/Express) | `releases/README.md` |
| [releases/HTAS-v1.0.0-fastapi.zip](releases/HTAS-v1.0.0-fastapi.zip) | Paquete de despliegue del servicio Python (FastAPI) | `releases/README.md` |
| [releases/HTAS-Paquete-Completo.zip](releases/HTAS-Paquete-Completo.zip) | Paquete maestro con todos los componentes | `releases/README.md` |
| [releases/HTAS-Ejecutable-Lanzador.bat](releases/HTAS-Ejecutable-Lanzador.bat) | Lanzador para Windows del sistema | `releases/README.md` |

> Nota: `v1.0.0` existe como **etiqueta** en ambos repositorios, pero todavía no tiene una
> *Release* publicada en GitHub (con notas y archivos adjuntos). Los enlaces muestran la etiqueta.

## Documentación

| Enlace | Descripción | Origen |
|---|---|---|
| [README.md](README.md) | Documentación principal del proyecto | — |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios | — |
| [docs/README.md](docs/README.md) | Índice de la documentación técnica | — |
| [docs/01_Historial_de_Versiones_HTAS.docx](docs/01_Historial_de_Versiones_HTAS.docx) | Historial de versiones | `docs/README.md` |
| [docs/02_Guia_Instalacion_y_Ejecucion_HTAS.docx](docs/02_Guia_Instalacion_y_Ejecucion_HTAS.docx) | Guía de instalación y ejecución | `docs/README.md` |
| [docs/03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.docx](docs/03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.docx) | Paquetes de despliegue y ejecutables | `docs/README.md` |
| [docs/Documentacion_Integral_HTAS.docx](docs/Documentacion_Integral_HTAS.docx) | Documentación técnica integral (portada UTCV) | `docs/README.md` |
| [Metodologia/Articulo HTAS  v1.docx.pdf](<Metodologia/Articulo HTAS  v1.docx.pdf>) | Artículo del proyecto HTAS | — |
| [Metodologia/DISENO_DEL_REPOSITORIO_MULTIDISCIPLINARIOdocx.pdf](Metodologia/DISENO_DEL_REPOSITORIO_MULTIDISCIPLINARIOdocx.pdf) | Diseño del repositorio multidisciplinario | — |
| [Metodologia/cedula_prueba_htas.pdf](Metodologia/cedula_prueba_htas.pdf) | Cédula de prueba | — |
| [Metodologia/Arquitectura de HTAS V4.png](<Metodologia/Arquitectura de HTAS V4.png>) | Diagrama de arquitectura v4 | — |
| https://keepachangelog.com/es/1.0.0/ | Formato usado en el CHANGELOG | `CHANGELOG.md` |

## Despliegues / Servidores

### Producción

| Enlace | Descripción | Origen |
|---|---|---|
| https://hipertensionarterialsistemica1.web.app | Frontend en Firebase Hosting (proyecto `hipertensionarterialsistemica1`) | `Arquitectura/Backend/src/controllers/pagos.controller.js`, `Arquitectura/FrontEnd/.firebaserc` |
| https://hipertensionarterialsistemica1.web.app/landing | Landing page (redirección al cancelar un pago) | `Arquitectura/Backend/src/controllers/pagos.controller.js` |
| https://hipertensionarterialsistemica1.web.app/success | Página de pago exitoso (Stripe Checkout) | `Arquitectura/Backend/src/controllers/pagos.controller.js` |
| https://hipertensionarterialsistemica1.firebaseapp.com | Dominio de autenticación de Firebase | `Arquitectura/FrontEnd/src/app/app.config.ts` |
| https://htas-backend.vercel.app | Backend Node.js/Express en Vercel | `Arquitectura/Backend/src/swagger.js` |
| https://htas-backend.vercel.app/api/contacto | Endpoint del formulario de contacto | `Arquitectura/FrontEnd/src/app/features/landing/pages/contacto/contacto.ts` |
| https://htas-backend.vercel.app/api/mediciones | Endpoint de mediciones (monitoreo wearable) | `Arquitectura/Backend/python/dispositivo/monitoreo_wearable.py` |
| https://htas-python.onrender.com | Servicio Python/FastAPI en Render | `Arquitectura/Backend/src/services/python.service.js` |
| https://htas-1wv5.onrender.com | Servicio Python/FastAPI en Render (alterno) | `Arquitectura/Backend/src/services/python.service.js` |

### Desarrollo local

| Enlace | Descripción | Origen |
|---|---|---|
| http://localhost:4200 | Frontend Angular (`ng serve`) | `README.md`, `Arquitectura/FrontEnd/README.md`, `releases/HTAS-Ejecutable-Lanzador.bat` |
| http://localhost:3000 | Backend Node.js/Express | `README.md`, `Arquitectura/Backend/src/swagger.js` |
| http://localhost:3000/api | Base de la API REST (auth, usuarios, citas, medicamentos, tratamientos, tomas, dispositivos, mediciones, solicitudes, algorithm, pagos) | `Arquitectura/FrontEnd/src/environments/environment.ts` |
| http://localhost:3000/api/docs | Documentación Swagger del backend | `Arquitectura/Backend/src/swagger.js` |
| http://localhost:3000/api/googlefit/callback | Callback OAuth de Google Fit | `Arquitectura/Backend/.env.example` |
| http://127.0.0.1:8000 | Servicio Python/FastAPI | `README.md`, `Arquitectura/Backend/src/app.js` |
| http://127.0.0.1:8000/docs | Documentación interactiva de FastAPI | `README.md` |
| http://localhost:9876/debug.html | Depuración de pruebas unitarias (Karma) | `Arquitectura/FrontEnd/.vscode/launch.json` |

## Herramientas y servicios externos

| Enlace | Descripción | Origen |
|---|---|---|
| https://angular.dev | Framework Angular | `README.md` |
| https://angular.dev/tools/cli | Angular CLI | `Arquitectura/FrontEnd/README.md` |
| https://angular.dev/reference/configs/angular-compiler-options | Opciones del compilador de Angular | `Arquitectura/FrontEnd/tsconfig.json` |
| https://github.com/angular/angular-cli | Repositorio de Angular CLI | `Arquitectura/FrontEnd/README.md` |
| https://nodejs.org | Node.js | `README.md`, `build.bat`, `build.ps1` |
| https://python.org | Python | `build.bat`, `build.ps1` |
| https://fastapi.tiangolo.com | FastAPI | `README.md` |
| https://www.postgresql.org | PostgreSQL | `README.md` |
| https://www.typescriptlang.org/docs/handbook/tsconfig-json.html | Configuración de TypeScript | `Arquitectura/FrontEnd/tsconfig.json` |
| https://vitest.dev/ | Vitest (pruebas unitarias) | `Arquitectura/FrontEnd/README.md` |
| https://www.google.com/recaptcha/api.js | Google reCAPTCHA (cliente) | `Arquitectura/FrontEnd/src/app/features/auth/login/login.ts` |
| https://www.google.com/recaptcha/api/siteverify | Google reCAPTCHA (verificación en servidor) | `Arquitectura/Backend/src/utils/verificarRecaptcha.js` |
| https://ui-avatars.com/api/ | Generador de avatares de usuario | `Arquitectura/FrontEnd/src/app/features/dashboard/**` |
| https://fonts.googleapis.com/css2?family=Montserrat | Fuente Montserrat (Google Fonts) | `Arquitectura/FrontEnd/src/styles.css` |
| https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js | Iconos Ionicons | `Arquitectura/FrontEnd/src/index.html` |
| https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/ | Swagger UI (CSS y JS) | `Arquitectura/Backend/src/swagger.js` |
| https://img.shields.io | Insignias (badges) del README | `README.md` |

## Otros

| Enlace | Descripción | Origen |
|---|---|---|
| https://editorconfig.org | Formato EditorConfig | `Arquitectura/FrontEnd/.editorconfig` |
| https://docs.github.com/get-started/getting-started-with-git/ignoring-files | Guía de `.gitignore` | `Arquitectura/FrontEnd/.gitignore` |
| https://go.microsoft.com/fwlink/?linkid=827846 | Recomendaciones de extensiones de VS Code | `Arquitectura/FrontEnd/.vscode/extensions.json` |
| https://go.microsoft.com/fwlink/?linkid=830387 | Configuración de depuración de VS Code | `Arquitectura/FrontEnd/.vscode/launch.json` |
| https://go.microsoft.com/fwlink/?LinkId=733558 | Configuración de tareas de VS Code | `Arquitectura/FrontEnd/.vscode/tasks.json` |
| http://www.w3.org/2000/svg | Espacio de nombres SVG (usado en iconos) | Varios `.css` / `.html` del frontend |
