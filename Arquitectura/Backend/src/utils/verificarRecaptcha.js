const axios = require('axios');

async function verificarRecaptcha(token) {
  if (!token) {
    return { success: false, errorCodes: ['token-vacio'] };
  }

  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn('⚠️ RECAPTCHA_SECRET_KEY no configurada, omitiendo validación');
    return { success: true, errorCodes: [] };
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        }
      }
    );

    const { success, 'error-codes': errorCodes = [], hostname, score, action } = response.data;

    if (!success) {
      console.warn('❌ reCAPTCHA fallido. Códigos de error:', errorCodes, 'hostname:', hostname);
    } else {
      console.log('✅ reCAPTCHA OK. hostname:', hostname, 'score:', score, 'action:', action);
    }

    return { success: success === true, errorCodes, hostname };
  } catch (error) {
    console.error('❌ Error al verificar reCAPTCHA con Google:', error.message);
    // En caso de error de red con Google, permitir el acceso para no bloquear usuarios
    return { success: true, errorCodes: ['network-error'] };
  }
}

module.exports = { verificarRecaptcha };