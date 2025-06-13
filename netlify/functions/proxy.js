// File: netlify/functions/proxy.js

// Usiamo "Buffer" per decodificare i file da Base64
const { Buffer } = require('buffer');

exports.handler = async function (event, context) {
  // Gestione della richiesta preliminare CORS (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
      body: ''
    };
  }

  // Costruzione dell'URL di destinazione
  const path = event.path.replace('/api', '');
  const targetUrl = `https://api.pdfrest.com${path}`;

  // Leggiamo la chiave API sicura dalle variabili d'ambiente
  const apiKey = process.env.PDFREST_API_KEY;

  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'La chiave API non è configurata sul server.' }) };
  }

  try {
    // ================================================================
    // === QUESTA È LA CORREZIONE CHIAVE ===
    // Controlliamo se Netlify ha codificato il corpo della richiesta in Base64.
    // Se sì, lo decodifichiamo per riottenere il file binario originale.
    const requestBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    // ================================================================

    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        'Api-Key': apiKey,
        'Content-Type': event.headers['content-type'],
      },
      // Usiamo il corpo della richiesta, eventualmente decodificato
      body: requestBody,
    });

    const responseBody = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: responseBody,
    };

  } catch (error) {
    return { statusCode: 502, body: JSON.stringify({ error: `Errore nella funzione proxy: ${error.message}` }) };
  }
};
