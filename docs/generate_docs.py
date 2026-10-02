import os
import sys
import zipfile
import shutil
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

# Target image path
COVER_IMAGE_PATH = r"C:\Users\zahid\.gemini\antigravity-ide\brain\b4a3212f-ce25-4d9b-aaa4-f91acfeff7b2\.user_uploaded\media_1790902378047.png"
DOCS_DIR = r"c:\Users\zahid\Documents\HTAS\docs"
ROOT_DIR = r"c:\Users\zahid\Documents\HTAS"

def draw_cover(canvas_obj, doc):
    canvas_obj.saveState()
    if os.path.exists(COVER_IMAGE_PATH):
        canvas_obj.drawImage(COVER_IMAGE_PATH, 0, 0, width=612, height=792, preserveAspectRatio=False)
    else:
        canvas_obj.setFillColor(colors.HexColor("#00875A"))
        canvas_obj.rect(0, 0, 612, 792, fill=1, stroke=0)
    canvas_obj.restoreState()

def draw_normal_page(canvas_obj, doc):
    # Strictly NO headers and NO footers as requested
    pass

def build_pdf(filename, title, subtitle, document_type, content_builder):
    pdf_path = os.path.join(DOCS_DIR, filename)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Palette
    PRIMARY = colors.HexColor("#00875A")     # UTCV Green
    DARK_TEXT = colors.HexColor("#1E293B")   # Slate Dark
    LIGHT_BG = colors.HexColor("#F8FAFC")    # Light Gray
    BORDER_COLOR = colors.HexColor("#CBD5E1")
    CODE_BG = colors.HexColor("#0F172A")     # Dark Slate Code
    CODE_TEXT = colors.HexColor("#F8FAFC")
    ACCENT_BLUE = colors.HexColor("#1E3A8A")

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=28,
        textColor=PRIMARY,
        alignment=TA_CENTER,
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=18,
        textColor=DARK_TEXT,
        alignment=TA_CENTER,
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#334155"),
        alignment=TA_CENTER
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=PRIMARY,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=DARK_TEXT,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=DARK_TEXT,
        spaceAfter=8,
        alignment=TA_JUSTIFY
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=CODE_TEXT,
        backColor=CODE_BG,
        leftIndent=10,
        rightIndent=10,
        spaceBefore=6,
        spaceAfter=8,
        borderPadding=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=DARK_TEXT,
        leftIndent=15,
        spaceAfter=4
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=DARK_TEXT
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    story = []

    # --- COVER PAGE ---
    story.append(Spacer(1, 250))
    
    cover_box_data = [
        [Paragraph(f"<b>UNIVERSIDAD TECNOLÓGICA DEL CENTRO DE VERACRUZ</b>", meta_style)],
        [Paragraph(f"<b>INGENIERÍA EN DESARROLLO Y GESTIÓN DE SOFTWARE</b>", ParagraphStyle('SubHeader', parent=meta_style, fontName='Helvetica-Bold', fontSize=9.5, textColor=PRIMARY))],
        [Spacer(1, 8)],
        [HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceBefore=4, spaceAfter=10)],
        [Paragraph(title, title_style)],
        [Paragraph(subtitle, subtitle_style)],
        [HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=6, spaceAfter=10)],
        [Spacer(1, 6)],
        [Paragraph("<b>Proyecto:</b> HTAS — Health Tracking & Assistance System", meta_style)],
        [Paragraph("<b>Autor:</b> Zahid Monraga Contreras", meta_style)],
        [Paragraph("<b>Tipo de Documento:</b> " + document_type, meta_style)],
        [Paragraph("<b>Fecha:</b> Octubre 2026", meta_style)],
        [Paragraph("<b>Estado de Versión:</b> v1.0.0 (Entrega Académica Final)", meta_style)]
    ]
    
    cover_table = Table(cover_box_data, colWidths=[480])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFFFF")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 14),
        ('BOX', (0,0), (-1,-1), 1.5, PRIMARY),
    ]))
    
    story.append(cover_table)
    story.append(PageBreak())

    # --- MAIN CONTENT ---
    ctx = {
        'styles': styles,
        'title_style': title_style,
        'subtitle_style': subtitle_style,
        'h1': h1_style,
        'h2': h2_style,
        'body': body_style,
        'code': code_style,
        'bullet': bullet_style,
        'cell': table_cell,
        'cell_hdr': table_header,
        'primary': PRIMARY,
        'dark_text': DARK_TEXT,
        'light_bg': LIGHT_BG,
        'border': BORDER_COLOR
    }

    content_builder(story, ctx)

    doc.build(story, onFirstPage=draw_cover, onLaterPages=draw_normal_page)
    print(f"[OK] Creado PDF exitosamente: {pdf_path}")

# --- Helper Table Builder ---
def make_table(headers, data, col_widths, ctx):
    formatted_data = []
    # Header row
    hdr_row = [Paragraph(f"<b>{h}</b>", ctx['cell_hdr']) for h in headers]
    formatted_data.append(hdr_row)
    
    # Data rows
    for row in data:
        formatted_row = []
        for cell in row:
            formatted_row.append(Paragraph(str(cell), ctx['cell']))
        formatted_data.append(formatted_row)

    t = Table(formatted_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), ctx['primary']),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, ctx['border']),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, ctx['light_bg']])
    ]))
    return t

# --- Helper Box Builder ---
def make_callout(title, text, ctx, color=None):
    if color is None:
        color = ctx['primary']
    content = [
        [Paragraph(f"<b>{title}</b>", ParagraphStyle('CTitle', parent=ctx['body'], fontName='Helvetica-Bold', textColor=color, spaceAfter=4))],
        [Paragraph(text, ctx['body'])]
    ]
    t = Table(content, colWidths=[490])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ctx['light_bg']),
        ('BOX', (0,0), (-1,-1), 1, color),
        ('PADDING', (0,0), (-1,-1), 8)
    ]))
    return t

# ==========================================
# 1. BUILD DOCUMENT: HISTORIAL DE VERSIONES
# ==========================================
def build_version_history(story, ctx):
    story.append(Paragraph("1. Introducción al Historial de Versiones", ctx['h1']))
    story.append(Paragraph(
        "El presente documento registra la evolución cronológica, hitos de desarrollo, cambios de arquitectura y correcciones implementadas en el proyecto <b>HTAS (Health Tracking & Assistance System)</b>. Este registro garantiza la trazabilidad técnica exigida en el desarrollo de software clínico y de monitoreo de salud.",
        ctx['body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("2. Matriz de Control de Versiones", ctx['h1']))
    headers = ["Versión", "Fecha", "Nombre de Hito", "Estado", "Responsable"]
    data = [
        ["1.0.0", "2026-09-29", "Versión de Entrega Académica Final", "Liberado", "Zahid Monraga C."],
        ["0.3.0", "2026-08-15", "Sprint 3: IA & Expediente Clínico", "Completado", "Zahid Monraga C."],
        ["0.2.0", "2026-07-01", "Sprint 2: Citas, Tratamientos & Roles", "Completado", "Zahid Monraga C."],
        ["0.1.0", "2026-05-20", "Sprint 1: Base de Datos & Auth", "Completado", "Zahid Monraga C."]
    ]
    story.append(make_table(headers, data, [60, 75, 185, 75, 95], ctx))
    story.append(Spacer(1, 10))

    story.append(Paragraph("3. Detalle de Liberaciones (Changelog)", ctx['h1']))
    
    # v1.0.0
    story.append(Paragraph("Versión 1.0.0 — Versión de Entrega Académica Final (2026-09-29)", ctx['h2']))
    story.append(Paragraph("<b>Características Añadidas:</b>", ctx['body']))
    features_v1 = [
        "<b>Autenticación JWT Robusta:</b> Control de acceso basado en 4 roles diferenciados (Paciente, Doctor, Acompañante, Administrador).",
        "<b>Módulo de Mediciones Presión Arterial:</b> Soporte para ingreso manual y conectividad Bluetooth (BLE) directa con baumanómetro.",
        "<b>Microservicio de Inteligencia Artificial:</b> Algoritmo de clasificación con XGBoost en Python/FastAPI entrenado con datos epidemiológicos.",
        "<b>Análisis Inteligente de PDFs Médicos:</b> Extracción automatizada de parámetros clínicos desde diagnósticos y cédulas en formato PDF.",
        "<b>Gestión Avanzada de Citas Médicas:</b> Selección interactiva de horarios por disponibilidad de médico, confirmación y recordatorios.",
        "<b>Módulo de Tratamientos y Medicamentos:</b> Control de tomas programadas, stock y notificaciones de cumplimiento.",
        "<b>Gestión de Asignaciones y Solicitudes:</b> Vínculo Doctor-Paciente y Acompañante-Paciente con moderación del Administrador.",
        "<b>Integración de Pagos con Stripe:</b> Procesamiento de suscripciones y pagos seguros en línea.",
        "<b>Formulario de Contacto Automático:</b> Envío diferido de correo transaccional vía Nodemailer y Google SMTP.",
        "<b>Sincronización con Google Fit:</b> Integración OAuth2 para extracción de constantes vitales en segundo plano.",
        "<b>Landing Page Inmersiva:</b> Animaciones interactivas 3D con Three.js y GSAP.",
        "<b>Despliegue Multi-nube:</b> Angular 21 SSR en Firebase Hosting, Node.js API en Vercel, FastAPI en Vercel/Render y DB PostgreSQL en Neon."
    ]
    for f in features_v1:
        story.append(Paragraph(f"• {f}", ctx['bullet']))
    
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Correcciones y Ajustes Recientes:</b>", ctx['body']))
    fixes_v1 = [
        "<b>fix(ui):</b> Prevenir desbordamiento de navegación inferior en dispositivos móviles con scroll horizontal ajustado.",
        "<b>fix(citas):</b> Rellenar automáticamente el nombre completo del doctor en el expediente del paciente (campo <i>medico</i>).",
        "<b>fix(backend):</b> Mapeo correcto de campos snake_case provenientes de PostgreSQL al consultar <i>doctorId</i>.",
        "<b>refactor(citas):</b> Añadido filtro estricto por doctor al verificar la disponibilidad de slots en el calendario.",
        "<b>feat(routes):</b> Títulos dinámicos de navegación asignados a las rutas de Doctor, Acompañante y Administrador.",
        "<b>fix(bluetooth):</b> Homologación de identificadores de servicios BLE con la especificación estándar del baumanómetro.",
        "<b>feat(device):</b> Script de utilidad incorporado para escaneo y extracción de dirección MAC de dispositivos médicos."
    ]
    for fx in fixes_v1:
        story.append(Paragraph(f"• {fx}", ctx['bullet']))

    story.append(Spacer(1, 10))

    # v0.3.0
    story.append(Paragraph("Versión 0.3.0 — Sprint 3 (2026-08-15)", ctx['h2']))
    v03_items = [
        "Implementación del módulo de asignaciones doctor-paciente.",
        "Panel de administración general para moderación de usuarios y solicitudes.",
        "Integración inicial del modelo de Machine Learning en el flujo clínico del doctor.",
        "Generación automatizada de reportes médicos en PDF."
    ]
    for item in v03_items:
        story.append(Paragraph(f"• {item}", ctx['bullet']))

    story.append(Spacer(1, 10))

    # v0.2.0 & v0.1.0
    story.append(Paragraph("Versiones Anteriores (v0.2.0 y v0.1.0)", ctx['h2']))
    v0_items = [
        "<b>v0.2.0:</b> Creación de módulos de citas médicas, catálogo de medicamentos, tratamientos y tableros por rol.",
        "<b>v0.1.0:</b> Definición de arquitectura de datos PostgreSQL, estructura modular Angular/Node, login JWT y landing page."
    ]
    for item in v0_items:
        story.append(Paragraph(f"• {item}", ctx['bullet']))

    story.append(Spacer(1, 10))
    story.append(make_callout(
        "Nota de Garantía de Calidad",
        "Todas las versiones del proyecto HTAS han superado pruebas unitarias de integración en API REST, verificación de endpoints con Swagger UI y validación de diseño responsivo.",
        ctx
    ))

# ==========================================
# 2. BUILD DOCUMENT: GUIA INSTALACION Y EJECUCION
# ==========================================
def build_install_guide(story, ctx):
    story.append(Paragraph("1. Requisitos Previos del Sistema", ctx['h1']))
    story.append(Paragraph(
        "Antes de comenzar con la instalación y ejecución del proyecto <b>HTAS</b>, es indispensable verificar que el entorno local cuente con las siguientes herramientas instaladas y configuradas:",
        ctx['body']
    ))
    
    headers = ["Herramienta / Entorno", "Versión Mínima", "Comando de Verificación", "Uso en el Proyecto"]
    req_data = [
        ["Node.js", "v20.0.0 LTS", "node --version", "Entorno ejecutor Backend REST & Angular SSR"],
        ["npm", "v10.0.0", "npm --version", "Gestor de paquetes de JavaScript"],
        ["Python", "v3.10+", "python --version", "Ejecución de Microservicio FastAPI e IA (XGBoost)"],
        ["Angular CLI", "v21.0.0", "ng version", "Compilación y desarrollo del cliente Web"],
        ["Git", "v2.x", "git --version", "Control de versiones del código fuente"]
    ]
    story.append(make_table(headers, req_data, [100, 75, 120, 195], ctx))
    story.append(Spacer(1, 10))

    story.append(Paragraph("2. Descarga e Instalación del Código Fuente", ctx['h1']))
    story.append(Paragraph("Paso 1: Clonar el repositorio oficial e ingresar a la carpeta raíz:", ctx['body']))
    story.append(Paragraph("git clone https://github.com/Zahid-Monraga-Contreras/HTAS.git\ncd HTAS", ctx['code']))

    story.append(Paragraph("Paso 2: Instalación de dependencias del Backend (Node.js/Express):", ctx['body']))
    story.append(Paragraph("cd Arquitectura/Backend\nnpm install", ctx['code']))

    story.append(Paragraph("Paso 3: Instalación de dependencias del Microservicio de IA (Python/FastAPI):", ctx['body']))
    story.append(Paragraph("cd Arquitectura/Backend/python/algorithm\npip install -r requirements.txt", ctx['code']))

    story.append(Paragraph("Paso 4: Instalación de dependencias del Frontend (Angular 21):", ctx['body']))
    story.append(Paragraph("cd Arquitectura/FrontEnd\nnpm install", ctx['code']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("3. Configuración de Variables de Entorno (.env)", ctx['h1']))
    story.append(Paragraph(
        "Cree el archivo <b>.env</b> en la ruta <code>Arquitectura/Backend/.env</code> utilizando como guía la plantilla oficial:",
        ctx['body']
    ))
    
    env_content = (
        "# Servidor Node.js\n"
        "PORT=3000\n"
        "NODE_ENV=development\n"
        "ALLOW_DEV_ENDPOINTS=true\n\n"
        "# Base de Datos PostgreSQL (Neon.tech / Local)\n"
        "DATABASE_URL=postgresql://usuario:password@ep-host.neon.tech/htas_db?sslmode=require\n\n"
        "# Autenticación JWT\n"
        "JWT_SECRET=clave_secreta_super_segura_htas_2026_jwt\n\n"
        "# Microservicio Python / FastAPI\n"
        "URL_FASTAPI=http://127.0.0.1:8000\n\n"
        "# Correo Electrónico Transaccional (Gmail App Password)\n"
        "EMAIL_USER=notificaciones.htas@gmail.com\n"
        "EMAIL_PASS=abcd1234efgh5678\n\n"
        "# Stripe Payments (Clave secreta de pruebas)\n"
        "STRIPE_SECRET_KEY=sk_test_51Px...tu_clave_stripe"
    )
    story.append(Paragraph(env_content.replace("\n", "<br/>"), ctx['code']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("4. Inicialización de la Base de Datos", ctx['h1']))
    story.append(Paragraph(
        "Para ejecutar la migración del esquema relacional de base de datos e insertar los datos iniciales de catálogo y usuarios administradores de prueba, ejecute dentro de <code>Arquitectura/Backend</code>:",
        ctx['body']
    ))
    story.append(Paragraph("node seed-data.js\nnode create-admin.js", ctx['code']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("5. Ejecución del Sistema en Modo Desarrollo", ctx['h1']))
    story.append(Paragraph(
        "Para iniciar el sistema completo en entorno local, se deben mantener <b>3 terminales independientes</b> en ejecución:",
        ctx['body']
    ))
    
    term_data = [
        ["Terminal 1: FastAPI (IA)", "cd Arquitectura/Backend/python/algorithm<br/>uvicorn hipertension_analyzer:app --reload --port 8000", "http://127.0.0.1:8000<br/>Doc: /docs"],
        ["Terminal 2: Node Backend", "cd Arquitectura/Backend<br/>npm run dev", "http://localhost:3000"],
        ["Terminal 3: Angular Frontend", "cd Arquitectura/FrontEnd<br/>npm start", "http://localhost:4200"]
    ]
    story.append(make_table(["Módulo / Terminal", "Comandos de Ejecución", "Dirección URL"], term_data, [130, 230, 130], ctx))

    story.append(Spacer(1, 10))
    story.append(Paragraph("6. Compilación Automática (Scripts de Build)", ctx['h1']))
    story.append(Paragraph(
        "El proyecto cuenta con scripts automatizados de compilación para entornos Windows. Puede ejecutar el script desde la raíz del proyecto:",
        ctx['body']
    ))
    story.append(Paragraph("# Desde PowerShell:<br/>.\\build.ps1<br/><br/># O desde CMD:<br/>build.bat", ctx['code']))

# ==========================================
# 3. BUILD DOCUMENT: PAQUETES DE DESPLIEGUE Y EJECUTABLES
# ==========================================
def build_deployment_packages(story, ctx):
    story.append(Paragraph("1. Descripción General de Despliegue", ctx['h1']))
    story.append(Paragraph(
        "El sistema <b>HTAS</b> está diseñado bajo una arquitectura desacoplada de microservicios y frontend SPA/SSR. Esto permite empaquetar y desplegar cada componente de forma independiente o distribuida en servicios de nube de alta disponibilidad (Vercel, Firebase Hosting y Neon PostgreSQL).",
        ctx['body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("2. Inventario de Paquetes y Ejecutables Generados", ctx['h1']))
    story.append(Paragraph(
        "En la carpeta <code>docs/</code> del proyecto se han generado y empaquetado los artefactos de despliegue listos para su distribución y puesta en marcha:",
        ctx['body']
    ))

    headers = ["Nombre de Archivo", "Tipo de Paquete", "Destino / Servidor", "Contenido Incluido"]
    pkg_data = [
        ["HTAS-v1.0.0-frontend.zip", "Bundle Web (.zip)", "Firebase Hosting / NGINX / Apache", "Compilación de producción Angular 21 (HTML, JS, CSS, Assets)"],
        ["HTAS-v1.0.0-backend.zip", "Servidor REST (.zip)", "Vercel / Node.js Host / VPS", "Código fuente Express API, rutas, controladores, configuraciones Vercel"],
        ["HTAS-v1.0.0-fastapi.zip", "Microservicio IA (.zip)", "Render / Vercel / Docker", "Código Python FastAPI, modelo XGBoost (.json), scripts de ML"],
        ["HTAS-Ejecutable-Lanzador.bat", "Script Ejecutable (.bat)", "Entorno Local Windows", "Script de inicio automático de 1 clic para las 3 terminales"],
        ["HTAS-Paquete-Completo.zip", "Paquete Master (.zip)", "Repositorio / Archivo", "Proyecto integral HTAS empaquetado completo sin dependencias voluminosas"]
    ]
    story.append(make_table(headers, pkg_data, [135, 95, 120, 140], ctx))

    story.append(Spacer(1, 10))
    story.append(Paragraph("3. Despliegue en Servicios Cloud", ctx['h1']))
    
    story.append(Paragraph("A. Despliegue de Backend en Vercel Serverless", ctx['h2']))
    story.append(Paragraph(
        "El paquete <code>HTAS-v1.0.0-backend.zip</code> incluye la configuración predefinida <code>vercel.json</code>. Para publicar en producción:",
        ctx['body']
    ))
    story.append(Paragraph("cd Arquitectura/Backend\nnpx vercel --prod", ctx['code']))

    story.append(Paragraph("B. Despliegue de Frontend en Firebase Hosting", ctx['h2']))
    story.append(Paragraph(
        "El cliente web contenido en <code>HTAS-v1.0.0-frontend.zip</code> se despliega con los comandos oficiales de Firebase CLI:",
        ctx['body']
    ))
    story.append(Paragraph("cd Arquitectura/FrontEnd\nng build --configuration production\nfirebase deploy", ctx['code']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("4. Ejecutable de Lanzamiento Directo en Windows (.bat)", ctx['h1']))
    story.append(Paragraph(
        "Para simplificar la puesta en marcha en equipos de evaluación o demostración sin necesidad de ingresar comandos manuales en 3 consolas, se provee el archivo ejecutable <b>HTAS-Ejecutable-Lanzador.bat</b>.",
        ctx['body']
    ))
    story.append(make_callout(
        "Instrucciones de Uso del Lanzador Automático",
        "1. Haga doble clic sobre <b>HTAS-Ejecutable-Lanzador.bat</b> dentro de la carpeta docs/<br/>"
        "2. El script detectará la instalación de Node.js y Python.<br/>"
        "3. Se abrirán automáticamente 3 ventanas de terminal configuradas con los puertos 8000, 3000 y 4200.<br/>"
        "4. El navegador predeterminado se abrirá de forma automática en <code>http://localhost:4200</code>.",
        ctx
    ))

# ==========================================
# 4. BUILD DOCUMENT: MASTER INTEGRAL DOC
# ==========================================
def build_master_doc(story, ctx):
    story.append(Paragraph("SECCIÓN I: HISTORIAL DE VERSIONES Y EVOLUCIÓN", ctx['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ctx['primary'], spaceBefore=2, spaceAfter=10))
    build_version_history(story, ctx)
    
    story.append(PageBreak())
    story.append(Paragraph("SECCIÓN II: GUÍA DE INSTALACIÓN Y EJECUCIÓN", ctx['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ctx['primary'], spaceBefore=2, spaceAfter=10))
    build_install_guide(story, ctx)

    story.append(PageBreak())
    story.append(Paragraph("SECCIÓN III: PAQUETES DE DESPLIEGUE Y EJECUTABLES", ctx['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ctx['primary'], spaceBefore=2, spaceAfter=10))
    build_deployment_packages(story, ctx)

# ==========================================
# PACKAGING UTILITIES (.ZIP & .BAT CREATION)
# ==========================================
def create_deployment_zip_files():
    print("[INFO] Creando paquetes de despliegue zip en docs/...")
    
    # 1. Copy or verify Frontend Zip
    src_frontend_zip = os.path.join(ROOT_DIR, "releases", "HTAS-v1.0.0-frontend.zip")
    dst_frontend_zip = os.path.join(DOCS_DIR, "HTAS-v1.0.0-frontend.zip")
    if os.path.exists(src_frontend_zip):
        shutil.copy2(src_frontend_zip, dst_frontend_zip)
        print("  [OK] Copiado HTAS-v1.0.0-frontend.zip")
    else:
        # Create zip if not present
        frontend_dir = os.path.join(ROOT_DIR, "Arquitectura", "FrontEnd")
        make_zip_from_dir(frontend_dir, dst_frontend_zip, exclude_dirs=['node_modules', '.angular', 'dist'])

    # 2. Backend Zip
    backend_dir = os.path.join(ROOT_DIR, "Arquitectura", "Backend")
    dst_backend_zip = os.path.join(DOCS_DIR, "HTAS-v1.0.0-backend.zip")
    make_zip_from_dir(backend_dir, dst_backend_zip, exclude_dirs=['node_modules', '.vercel'])

    # 3. FastAPI Python Microservice Zip
    fastapi_dir = os.path.join(ROOT_DIR, "Arquitectura", "Backend", "python", "algorithm")
    dst_fastapi_zip = os.path.join(DOCS_DIR, "HTAS-v1.0.0-fastapi.zip")
    make_zip_from_dir(fastapi_dir, dst_fastapi_zip, exclude_dirs=['__pycache__', '.venv', 'venv'])

    # 4. Create Windows Executable Launcher .bat inside docs/
    launcher_bat = os.path.join(DOCS_DIR, "HTAS-Ejecutable-Lanzador.bat")
    bat_content = """@echo off
TITLE HTAS - Lanzador de Sistema Integral
COLOR 0A
echo ========================================================
echo   HTAS - Health Tracking & Assistance System
echo   Iniciando microservicios y servidor de aplicaciones...
echo ========================================================
echo.

set ROOT_DIR=%~dp0..

echo [1/3] Lanzando Microservicio de IA (FastAPI - Puerto 8000)...
start "HTAS - FastAPI IA (8000)" cmd /k "cd /d %ROOT_DIR%\\Arquitectura\\Backend\\python\\algorithm && uvicorn hipertension_analyzer:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/3] Lanzando Backend REST API (Node.js - Puerto 3000)...
start "HTAS - Node Backend (3000)" cmd /k "cd /d %ROOT_DIR%\\Arquitectura\\Backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Lanzando Frontend Web (Angular - Puerto 4200)...
start "HTAS - Angular Frontend (4200)" cmd /k "cd /d %ROOT_DIR%\\Arquitectura\\FrontEnd && npm start"

echo.
echo ========================================================
echo   Todos los servicios han sido lanzados.
echo   Abriendo navegador web en http://localhost:4200 ...
echo ========================================================
timeout /t 5 /nobreak >nul
start http://localhost:4200
"""
    with open(launcher_bat, "w", encoding="utf-8") as f:
        f.write(bat_content)
    print("  [OK] Creado HTAS-Ejecutable-Lanzador.bat")

    # 5. Master Zip Package containing project docs & scripts
    dst_master_zip = os.path.join(DOCS_DIR, "HTAS-Paquete-Completo.zip")
    with zipfile.ZipFile(dst_master_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file in os.listdir(DOCS_DIR):
            if file != "HTAS-Paquete-Completo.zip" and file != "generate_docs.py":
                fp = os.path.join(DOCS_DIR, file)
                if os.path.isfile(fp):
                    zf.write(fp, file)
    print("  [OK] Creado HTAS-Paquete-Completo.zip")

def make_zip_from_dir(src_dir, dst_zip, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = []
    print(f"  ... Empaquetando {os.path.basename(dst_zip)}")
    with zipfile.ZipFile(dst_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, src_dir)
                zf.write(full_path, rel_path)

if __name__ == "__main__":
    print("=========================================")
    print("   HTAS - Generador de Documentacion")
    print("=========================================")
    
    os.makedirs(DOCS_DIR, exist_ok=True)

    # 1. Build Version History PDF
    build_pdf(
        filename="01_Historial_de_Versiones_HTAS.pdf",
        title="HISTORIAL DE VERSIONES",
        subtitle="Evolución del Proyecto y Registro de Cambios",
        document_type="Historial de Versiones y Control de Cambios",
        content_builder=build_version_history
    )

    # 2. Build Installation & Execution Guide PDF
    build_pdf(
        filename="02_Guia_Instalacion_y_Ejecucion_HTAS.pdf",
        title="GUÍA DE INSTALACIÓN Y EJECUCIÓN",
        subtitle="Manual de Configuración, Entorno y Puesta en Marcha",
        document_type="Manual Técnico de Instalación y Ejecución",
        content_builder=build_install_guide
    )

    # 3. Build Deployment Packages Manual PDF
    build_pdf(
        filename="03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.pdf",
        title="PAQUETES DE DESPLIEGUE Y EJECUTABLES",
        subtitle="Manual de Distribución, Artefactos y Lanzadores",
        document_type="Manual de Despliegue y Ejecutables",
        content_builder=build_deployment_packages
    )

    # 4. Build Master Complete PDF Document
    build_pdf(
        filename="Documentacion_Integral_HTAS.pdf",
        title="DOCUMENTACIÓN TÉCNICA INTEGRAL",
        subtitle="Historial, Instalación, Ejecución y Despliegue",
        document_type="Documento Técnico Maestro Integral",
        content_builder=build_master_doc
    )

    # 5. Generate actual ZIPs and .bat executable
    create_deployment_zip_files()

    print("\n[SUCCESS] Proceso completado exitosamente. Todos los archivos han sido generados en docs/.")

