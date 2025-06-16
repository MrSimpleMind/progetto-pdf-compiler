// File: netlify/functions/proxy.js
// ✅ MEGA-BATCH VERSION: Supporto timeout esteso e gestione file grandi

const { Buffer } = require('buffer');

exports.handler = async function (event, context) {
  // ✅ CORS preflight con headers estesi per mega-batch
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
        "Access-Control-Max-Age": "86400", // Cache preflight per 24h
      },
      body: ''
    };
  }

  // Costruzione URL target
  const path = event.path.replace('/api', '');
  const targetUrl = `https://api.pdfrest.com${path}`;

  // API Key sicura dall'ambiente
  const apiKey = process.env.PDFREST_API_KEY;

  if (!apiKey) {
    console.error('[PROXY] API key mancante nell\'ambiente Netlify');
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'La chiave API non è configurata sul server.' }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  }

  // ✅ MEGA-BATCH: Rilevamento operazioni lunghe
  const isLongOperation = path.includes('pdf-with-imported-form-data');
  const isUpload = path.includes('upload');
  const isPdfInfo = path.includes('pdf-info');

  try {
    // ✅ DECODIFICA BASE64: Gestione corretta file binari
    const requestBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    
    // ✅ LOGGING: Debug per mega-batch
    if (isLongOperation) {
      console.log('[MEGA-BATCH] Operazione lunga rilevata:', path);
      console.log('[MEGA-BATCH] Content-Length:', event.headers['content-length'] || 'unknown');
      console.log('[MEGA-BATCH] Timeout configurato: 45s');
    }

    // ✅ TIMEOUT MANAGEMENT: Configurazione dinamica
    let timeoutMs;
    if (isLongOperation) {
      timeoutMs = 45000; // 45s per mega-batch
    } else if (isUpload) {
      timeoutMs = 30000; // 30s per upload
    } else {
      timeoutMs = 15000; // 15s per operazioni standard
    }

    // ✅ ABORT CONTROLLER: Gestione timeout precisa
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[PROXY] Timeout dopo ${timeoutMs}ms per operazione:`, path);
      controller.abort();
    }, timeoutMs);

    // ✅ HEADERS: Configurazione ottimizzata
    const headers = {
      'Api-Key': apiKey,
    };

    // Mantieni Content-Type originale per multipart/form-data
    if (event.headers['content-type']) {
      headers['Content-Type'] = event.headers['content-type'];
    }

    // ✅ KEEPALIVE: Headers per mantenere viva la connessione
    if (isLongOperation) {
      headers['Connection'] = 'keep-alive';
      headers['Keep-Alive'] = 'timeout=60, max=1000';
    }

    console.log(`[PROXY] Inoltro richiesta a: ${targetUrl}`);
    console.log(`[PROXY] Metodo: ${event.httpMethod}, Timeout: ${timeoutMs}ms`);

    // ✅ FETCH: Chiamata con gestione avanzata
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: headers,
      body: requestBody,
      signal: controller.signal,
      // ✅ KEEPALIVE: Mantieni connessione per operazioni lunghe
      keepalive: isLongOperation
    });

    // Pulisci timeout se la richiesta è completata
    clearTimeout(timeoutId);

    // ✅ RESPONSE HEADERS: Ottimizzati per mega-batch
    const responseHeaders = {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // ✅ CACHE CONTROL: Evita caching per operazioni dinamiche
    if (isLongOperation) {
      responseHeaders["Cache-Control"] = "no-cache, no-store, must-revalidate";
      responseHeaders["Pragma"] = "no-cache";
      responseHeaders["Expires"] = "0";
    }

    // ✅ LOGGING: Risultato operazione
    const statusCode = response.status;
    console.log(`[PROXY] Risposta ricevuta: ${statusCode}`);
    
    if (isLongOperation) {
      console.log('[MEGA-BATCH] Operazione completata con successo');
    }

    // ✅ BODY HANDLING: Gestione sicura del contenuto
    let responseBody;
    try {
      responseBody = await response.text();
    } catch (bodyError) {
      console.error('[PROXY] Errore lettura body:', bodyError);
      responseBody = JSON.stringify({ error: 'Errore lettura risposta dal server' });
    }

    return {
      statusCode: statusCode,
      headers: responseHeaders,
      body: responseBody,
    };

  } catch (error) {
    console.error('[PROXY] Errore generale:', error);

    // ✅ ERROR HANDLING: Gestione specifica per timeout
    if (error.name === 'AbortError') {
      console.error('[PROXY] Timeout raggiunto per operazione:', path);
      return { 
        statusCode: 408, 
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          error: 'Timeout dell\'operazione',
          details: `Operazione ${path} ha superato il limite di ${isLongOperation ? '45s' : '15s'}`,
          type: 'timeout',
          suggested_action: 'Prova la modalità fallback per volumi molto grandi'
        })
      };
    }

    // ✅ NETWORK ERRORS: Gestione errori di rete
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('[PROXY] Errore di connessione a pdfRest API');
      return {
        statusCode: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: 'Servizio pdfRest temporaneamente non disponibile',
          details: 'Impossibile raggiungere l\'API pdfRest',
          type: 'network_error'
        })
      };
    }

    // ✅ GENERIC ERRORS: Fallback generico
    return { 
      statusCode: 502, 
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        error: `Errore nella funzione proxy: ${error.message}`,
        details: error.stack ? error.stack.split('\n')[0] : 'Dettagli non disponibili',
        type: 'proxy_error'
      })
    };
  }
};
