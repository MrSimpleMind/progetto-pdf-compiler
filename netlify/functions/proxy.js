// File: netlify/functions/proxy.js
// ✅ IMPROVED VERSION: Better timeout and error handling

const { Buffer } = require('buffer');

exports.handler = async function (event, context) {
  // Aumenta timeout massimo del context Netlify
  context.callbackWaitsForEmptyEventLoop = false;
  
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
        "Access-Control-Max-Age": "86400",
      },
      body: ''
    };
  }

  const path = event.path.replace('/api', '');
  const targetUrl = `https://api.pdfrest.com${path}`;
  const apiKey = process.env.PDFREST_API_KEY;

  if (!apiKey) {
    console.error('[PROXY] API key mancante');
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'API key mancante' }),
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    };
  }

  // ✅ DETECTION: Rileva tipo operazione
  const isLongOperation = path.includes('pdf-with-imported-form-data');
  const isUpload = path.includes('upload');
  
  // ✅ TIMEOUT SCALING: Timeout progressivi basati su operazione
  let timeoutMs;
  if (isLongOperation) {
    // Per mega-batch, proviamo timeout ancora più lungo
    timeoutMs = 50000; // 50s invece di 45s
  } else if (isUpload) {
    timeoutMs = 25000; // 25s per upload
  } else {
    timeoutMs = 15000; // 15s standard
  }

  try {
    const requestBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    
    // ✅ LOGGING: Enhanced per debug
    console.log(`[PROXY] ${event.httpMethod} ${path}`);
    console.log(`[PROXY] Timeout: ${timeoutMs}ms`);
    console.log(`[PROXY] Body size: ${requestBody ? requestBody.length : 0} bytes`);
    
    if (isLongOperation) {
      console.log('[MEGA-BATCH] Operazione lunga rilevata');
      console.log('[MEGA-BATCH] Timeout esteso attivo');
    }

    // ✅ ABORT CONTROLLER: Con gestione migliorata
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[PROXY] TIMEOUT dopo ${timeoutMs}ms per ${path}`);
      controller.abort();
    }, timeoutMs);

    // ✅ HEADERS: Ottimizzati per connessioni lunghe
    const headers = {
      'Api-Key': apiKey,
    };

    if (event.headers['content-type']) {
      headers['Content-Type'] = event.headers['content-type'];
    }

    // ✅ KEEPALIVE: Headers speciali per operazioni lunghe
    if (isLongOperation) {
      headers['Connection'] = 'keep-alive';
      headers['Keep-Alive'] = 'timeout=60, max=1000';
      headers['User-Agent'] = 'Netlify-Function-Mega-Batch/1.0';
    }

    console.log(`[PROXY] Tentativo connessione a: ${targetUrl}`);

    // ✅ FETCH: Con retry logic per connessioni fallite
    let lastError = null;
    let response = null;
    
    const maxRetries = isLongOperation ? 2 : 1; // Retry per operazioni lunghe
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[PROXY] Tentativo ${attempt}/${maxRetries}`);
        
        response = await fetch(targetUrl, {
          method: event.httpMethod,
          headers: headers,
          body: requestBody,
          signal: controller.signal,
        });
        
        // Se arriviamo qui, la connessione è riuscita
        break;
        
      } catch (fetchError) {
        lastError = fetchError;
        console.error(`[PROXY] Tentativo ${attempt} fallito:`, fetchError.message);
        
        if (attempt < maxRetries && !controller.signal.aborted) {
          console.log(`[PROXY] Retry in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    clearTimeout(timeoutId);
    
    // ✅ ERROR HANDLING: Se tutti i retry sono falliti
    if (!response) {
      throw lastError || new Error('Tutti i tentativi di connessione falliti');
    }

    console.log(`[PROXY] Risposta ricevuta: HTTP ${response.status}`);
    
    // ✅ RESPONSE HEADERS: Ottimizzati
    const responseHeaders = {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (isLongOperation) {
      responseHeaders["Cache-Control"] = "no-cache, no-store, must-revalidate";
      responseHeaders["X-Operation-Type"] = "mega-batch";
    }

    // ✅ BODY HANDLING: Gestione sicura con timeout
    let responseBody;
    const bodyTimeout = setTimeout(() => {
      console.error('[PROXY] Timeout lettura body');
    }, 10000);
    
    try {
      responseBody = await response.text();
      clearTimeout(bodyTimeout);
    } catch (bodyError) {
      clearTimeout(bodyTimeout);
      console.error('[PROXY] Errore lettura body:', bodyError);
      responseBody = JSON.stringify({ 
        error: 'Errore lettura risposta dal server',
        details: bodyError.message 
      });
    }

    // ✅ SUCCESS LOGGING: per debug
    if (isLongOperation && response.ok) {
      console.log('[MEGA-BATCH] ✅ SUCCESSO! Operazione completata');
      console.log(`[MEGA-BATCH] Response size: ${responseBody.length} chars`);
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    };

  } catch (error) {
    console.error('[PROXY] Errore generale:', error);

    // ✅ TIMEOUT HANDLING: Gestione specifica
    if (error.name === 'AbortError') {
      console.error('[PROXY] ⏰ TIMEOUT dopo', timeoutMs, 'ms');
      return { 
        statusCode: 408, 
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Error-Type": "timeout"
        },
        body: JSON.stringify({ 
          error: 'Timeout dell\'operazione',
          details: `Operazione ${path} ha superato ${timeoutMs}ms`,
          type: 'timeout',
          timeout_ms: timeoutMs,
          suggested_action: 'Attiva modalità fallback per bypassing Netlify limits'
        })
      };
    }

    // ✅ NETWORK ERRORS: Gestione specifica errori connessione
    if (error.code === 'ENOTFOUND') {
      console.error('[PROXY] 🌐 DNS resolution failed per pdfRest API');
      return {
        statusCode: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Error-Type": "dns"
        },
        body: JSON.stringify({
          error: 'Impossibile raggiungere pdfRest API',
          details: 'DNS resolution failed - possibile problema di rete',
          type: 'network_dns_error',
          suggested_action: 'Verifica connettività o prova fallback'
        })
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      console.error('[PROXY] 🔌 Connection refused/reset da pdfRest API');
      return {
        statusCode: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Error-Type": "connection"
        },
        body: JSON.stringify({
          error: 'pdfRest API non raggiungibile',
          details: `Connection error: ${error.code}`,
          type: 'network_connection_error',
          suggested_action: 'Verifica status pdfRest API o prova fallback'
        })
      };
    }

    // ✅ GENERIC ERRORS: Con più dettagli per debug
    console.error('[PROXY] Generic error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n')[0]
    });

    return { 
      statusCode: 502, 
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Error-Type": "generic"
      },
      body: JSON.stringify({ 
        error: `Errore proxy: ${error.message}`,
        details: error.stack ? error.stack.split('\n')[0] : 'Stack trace non disponibile',
        type: 'proxy_error',
        error_name: error.name,
        error_code: error.code || 'unknown',
        suggested_action: isLongOperation ? 'Prova modalità fallback' : 'Riprova operazione'
      })
    };
  }
};
