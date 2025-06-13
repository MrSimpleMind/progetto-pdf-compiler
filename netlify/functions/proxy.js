// File: netlify/functions/proxy.js

exports.handler = async function (event, context) {
  // Gestione della richiesta preliminare CORS (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type", // Rimuoviamo Api-Key da qui
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
      body: ''
    };
  }

  // Costruzione dell'URL di destinazione
  const path = event.path.replace('/api', '');
  const targetUrl = `https://api.pdfrest.com${path}`;

  // === LA PARTE PIÙ IMPORTANTE ===
  // Leggiamo la chiave API in modo sicuro dalle variabili d'ambiente di Netlify
  const apiKey = process.env.PDFREST_API_KEY;

  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'La chiave API non è configurata sul server.' }) };
  }

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        // Il proxy aggiunge la chiave API qui, in modo sicuro
        'Api-Key': apiKey,
        'Content-Type': event.headers['content-type'],
      },
      body: event.body,
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
