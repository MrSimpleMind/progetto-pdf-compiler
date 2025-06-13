// File: netlify/functions/proxy.js

exports.handler = async function (event, context) {
  // I browser inviano una richiesta "OPTIONS" prima di quella vera per i controlli CORS.
  // Dobbiamo rispondere correttamente a questa.
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, // No Content
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Api-Key",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
      body: ''
    };
  }

  // Costruiamo l'URL di destinazione (api.pdfrest.com)
  const path = event.path.replace('/api', ''); // Semplificato
  const targetUrl = `https://api.pdfrest.com${path}`;

  // Prendiamo la chiave API dagli "headers" della richiesta originale
  const apiKey = event.headers['api-key'];

  if (!apiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'La chiave API non era presente nella richiesta' }),
    };
  }

  try {
    // Usiamo la funzione "fetch" nativa, senza bisogno di librerie esterne
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        'Api-Key': apiKey, // Inoltriamo la chiave API a pdfRest
        'Content-Type': event.headers['content-type'], // Inoltriamo il tipo di contenuto (fondamentale per i file)
      },
      body: event.body, // Inoltriamo il corpo della richiesta (il file)
    });
    
    // Leggiamo la risposta da pdfRest
    const responseBody = await response.text();

    // La inviamo indietro al browser, aggiungendo gli header CORS
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: responseBody,
    };

  } catch (error) {
    return {
      statusCode: 502, // Errore del proxy
      body: JSON.stringify({ error: `Errore nella funzione proxy: ${error.message}` }),
    };
  }
};