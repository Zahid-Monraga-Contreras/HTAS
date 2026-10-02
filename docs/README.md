# 📁 Documentación y Paquetes de Despliegue — Proyecto HTAS

Todos los archivos requeridos han sido generados y organizados en este directorio (`c:\Users\zahid\Documents\HTAS\docs`).

---

## 📑 Documentos PDF Generados (Con Portada UTCV, Sin Encabezados ni Pies de Página)

1. **[`01_Historial_de_Versiones_HTAS.pdf`](file:///c:/Users/zahid/Documents/HTAS/docs/01_Historial_de_Versiones_HTAS.pdf)**
   - **Contenido:** Matriz de control de versiones, registro detallado de cambios (v0.1.0, v0.2.0, v0.3.0 y v1.0.0 Final), listado de características añadidas, correcciones de errores, refactorizaciones y auditoría de commits.

2. **[`02_Guia_Instalacion_y_Ejecucion_HTAS.pdf`](file:///c:/Users/zahid/Documents/HTAS/docs/02_Guia_Instalacion_y_Ejecucion_HTAS.pdf)**
   - **Contenido:** Requisitos previos de software y servicios en la nube, clonación, instalación de dependencias (Node.js, Python FastAPI, Angular), variables de entorno (`.env`), migración e inicialización de base de datos PostgreSQL, comandos de desarrollo y scripts de compilación.

3. **[`03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.pdf`](file:///c:/Users/zahid/Documents/HTAS/docs/03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.pdf)**
   - **Contenido:** Inventario de paquetes generados, manual de despliegue en Vercel (Backend), Firebase Hosting (Frontend), Render/Vercel (FastAPI) e instrucciones del lanzador ejecutable de Windows.

4. **[`Documentacion_Integral_HTAS.pdf`](file:///c:/Users/zahid/Documents/HTAS/docs/Documentacion_Integral_HTAS.pdf)**
   - **Contenido:** Documento técnico maestro unificado que integra los tres apartados anteriores en un solo archivo PDF institucional.

---

## 📦 Paquetes de Despliegue y Ejecutables Generados

- **[`HTAS-v1.0.0-frontend.zip`](file:///c:/Users/zahid/Documents/HTAS/docs/HTAS-v1.0.0-frontend.zip):** Paquete distribuible del cliente web Angular 21 listo para Firebase Hosting o servidor web.
- **[`HTAS-v1.0.0-backend.zip`](file:///c:/Users/zahid/Documents/HTAS/docs/HTAS-v1.0.0-backend.zip):** Paquete distribuible de la API REST Node.js/Express listo para Vercel o VPS.
- **[`HTAS-v1.0.0-fastapi.zip`](file:///c:/Users/zahid/Documents/HTAS/docs/HTAS-v1.0.0-fastapi.zip):** Paquete distribuible del microservicio de IA con FastAPI y XGBoost.
- **[`HTAS-Ejecutable-Lanzador.bat`](file:///c:/Users/zahid/Documents/HTAS/docs/HTAS-Ejecutable-Lanzador.bat):** Lanzador automático de 1 clic para Windows (abre las 3 terminales y el navegador local en `http://localhost:4200`).
- **[`HTAS-Paquete-Completo.zip`](file:///c:/Users/zahid/Documents/HTAS/docs/HTAS-Paquete-Completo.zip):** Archivo ZIP maestro que agrupa toda la documentación y paquetes listos para entrega.

---

## 🛠️ Script de Regeneración

- **[`generate_docs.py`](file:///c:/Users/zahid/Documents/HTAS/docs/generate_docs.py):** Script de Python que permite regenerar automáticamente todos los PDFs y archivos ZIP en cualquier momento ejecutando `python generate_docs.py`.
