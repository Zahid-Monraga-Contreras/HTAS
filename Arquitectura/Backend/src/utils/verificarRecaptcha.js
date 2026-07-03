const axios = require('axios');

async function verificarRecaptcha(token) {
  if (!token) return false;

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

  return response.data.success === true;
}

module.exports = { verificarRecaptcha };