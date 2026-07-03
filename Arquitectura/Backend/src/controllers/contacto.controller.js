const nodemailer = require("nodemailer");

const contactoController = {
    enviarMensaje: async (req, res) => {
        const { nombre, apellidos, email, telefono, mensaje } = req.body;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const iniciales = `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();

        const mailOptions = {
            from: `"HTAS Contacto" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            replyTo: email,
            subject: `Nuevo mensaje de contacto — ${nombre} ${apellidos}`,
            html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:32px 16px;">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">

    <!-- HEADER -->
    <tr><td style="background:#7B1C1C;padding:24px 32px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:3px;">HTAS</div>
      <div style="font-size:11px;color:#f0b0b0;letter-spacing:2px;margin-top:4px;text-transform:uppercase;">Nuevo mensaje de contacto</div>
    </td></tr>

    <!-- ACCENT BAR -->
    <tr><td style="height:4px;background:#C0392B;"></td></tr>

    <!-- BODY -->
    <tr><td style="padding:32px 36px 24px;">

      <!-- AVATAR + NOMBRE -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td width="68" valign="middle">
            <div style="width:56px;height:56px;border-radius:50%;background:#C0392B;text-align:center;line-height:56px;font-size:20px;font-weight:700;color:#ffffff;">
              ${iniciales}
            </div>
          </td>
          <td valign="middle">
            <div style="font-size:18px;font-weight:600;color:#1a1a1a;">${nombre} ${apellidos}</div>
            <div style="font-size:13px;color:#888888;margin-top:2px;">Mensaje recibido desde el formulario de contacto</div>
          </td>
        </tr>
      </table>

      <!-- CAMPOS: Nombre / Apellidos -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td width="49%" style="background:#fdf2f2;border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;color:#C0392B;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Nombre</div>
            <div style="font-size:14px;color:#1a1a1a;">${nombre}</div>
          </td>
          <td width="2%"></td>
          <td width="49%" style="background:#fdf2f2;border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;color:#C0392B;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Apellidos</div>
            <div style="font-size:14px;color:#1a1a1a;">${apellidos}</div>
          </td>
        </tr>
      </table>

      <!-- CAMPOS: Email / Teléfono -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td width="49%" style="background:#fdf2f2;border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;color:#C0392B;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Correo electrónico</div>
            <div style="font-size:14px;color:#C0392B;">${email}</div>
          </td>
          <td width="2%"></td>
          <td width="49%" style="background:#fdf2f2;border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;color:#C0392B;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Teléfono</div>
            <div style="font-size:14px;color:#1a1a1a;">${telefono}</div>
          </td>
        </tr>
      </table>

      <!-- MENSAJE -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f9f9f9;border-left:4px solid #C0392B;border-radius:0 8px 8px 0;padding:14px 16px;">
            <div style="font-size:10px;color:#C0392B;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Mensaje</div>
            <div style="font-size:14px;color:#333333;line-height:1.7;">${mensaje}</div>
          </td>
        </tr>
      </table>

      <hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 20px"/>
      <p style="font-size:12px;color:#999999;text-align:center;line-height:1.6;margin:0;">
        Este correo fue generado automáticamente desde el formulario de contacto de HTAS.<br/>
        Responde directamente a <a href="mailto:${email}" style="color:#C0392B;text-decoration:none;">${email}</a>
      </p>

    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#2a0a0a;padding:20px 32px;text-align:center;">
      <div style="font-size:13px;color:#e8a0a0;font-weight:600;letter-spacing:2px;margin-bottom:4px;">HTAS</div>
      <div style="font-size:11px;color:#b06060;">Hipertensión Arterial Sistémica · Monitoreo inteligente y control digital</div>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>
      `,
        };

        try {
            await transporter.sendMail(mailOptions);
            res.json({ message: "Correo enviado con éxito" });
        } catch (error) {
            console.error("Error nodemailer:", error);
            res.status(500).json({ error: "No se pudo enviar el correo" });
        }
    },
};

module.exports = contactoController;