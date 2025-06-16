# 🚀 PDF XFA Compiler - Mega-Batch Edition

**Versione:** 2.0 Mega-Batch  
**Deploy Live:** https://progetto-pdf-compiler.netlify.app/  
**Supporto Record:** Fino a 200+ record in una singola operazione  

## 🎯 Novità Mega-Batch

### ✨ Funzionalità Principali
- **🚀 Mega-Batch Processing:** Elabora fino a 200+ record in una sola chiamata API
- **⏱️ Timeout Esteso:** 45 secondi per operazioni complesse vs 10s standard
- **🔄 Fallback Automatico:** Modalità diretta se Netlify va in timeout
- **📊 Progress Tracking:** Monitoraggio real-time con stime tempo
- **🎯 Strategia Adattiva:** Calcolo automatico della migliore strategia

### 🏗️ Architettura Mega-Batch

```
CSV (200 record) → XML Unico → Singola API Call → PDF Compilato
     ↓
Fallback: Chiamata Diretta Browser (se timeout Netlify)
```

## 🚀 Quick Start

### 1. **Carica i File**
```bash
# CSV con fino a 200 record
COGNOME;NOME;C.F.;Qualifica (Q);...
Rossi;Mario;RSSMRA80A01H501Z;Medico;...
# ... fino a 200 righe
```

### 2. **Clicca Mega-Batch Compile**
Il sistema:
- ✅ Genera XML unico con tutti i record
- ✅ Usa timeout esteso (45s)
- ✅ Attiva fallback se necessario
- ✅ Mostra progress dettagliato

### 3. **Scarica il Risultato**
Un singolo PDF con tutti i record compilati.

## 📊 Performance Mega-Batch

| Volume Record | Strategia | Tempo Stimato | Modalità |
|---------------|-----------|---------------|----------|
| 1-30          | Single    | ~15s         | Standard |
| 31-100        | Mega      | ~25s         | Mega-Batch |
| 101-200       | Mega      | ~35s         | Mega-Batch |
| 200+          | Fallback  | ~45s         | Fallback |

## 🛠️ Installazione e Deploy

### Configurazione Netlify

1. **Fork del Repository**
```bash
git clone https://github.com/MrSimpleMind/progetto-pdf-compiler
cd progetto-pdf-compiler
```

2. **Configura Variabili d'Ambiente**
```bash
# Nel pannello Netlify > Site settings > Environment variables
PDFREST_API_KEY=your_pdfrest_api_key_here
```

3. **Deploy Automatico**
- Connetti repository GitHub a Netlify
- Deploy automatico ad ogni push su main branch

### File Modificati per Mega-Batch

#### `index.html`
- ✅ Funzione `compilePDF_MegaBatch()` 
- ✅ Fallback automatico `executeFallbackMode()`
- ✅ Progress tracking avanzato
- ✅ UI mega-batch con metriche real-time

#### `netlify/functions/proxy.js`
- ✅ Timeout esteso: 45s per operazioni lunghe
- ✅ Gestione keepalive per connessioni stabili
- ✅ Error handling specifico per timeout
- ✅ Headers ottimizzati per file grandi

#### `netlify.toml`
```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/proxy/:splat"
  status = 200
  force = true
```

## 🔧 Funzionalità Tecniche

### Mega-Batch XML Generation
```javascript
// Genera XML unico con tutti i record
function generateMegaBatchXML(records) {
    let xmlData = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlData += '<welfare xmlns="http://schemas.sygest.it/adobe">\n';
    
    records.forEach((record) => {
        xmlData += '  <personale_standard>\n';
        // Mapping campi CSV → XFA
        Object.entries(fieldMapping).forEach(([csvField, xfaField]) => {
            xmlData += `    <${xfaField}>${record[csvField]}</${xfaField}>\n`;
        });
        xmlData += '  </personale_standard>\n';
    });
    
    xmlData += '</welfare>';
    return xmlData;
}
```

### Fallback Mode
```javascript
// Chiamata diretta browser se Netlify timeout
async function executeFallbackMode() {
    const response = await fetch('https://api.pdfrest.com/pdf-with-imported-form-data', {
        method: 'POST',
        headers: { 'Api-Key': apiKey },
        body: formData,
        signal: AbortSignal.timeout(90000) // 90s senza limiti Netlify
    });
}
```

### Progress Streaming
```javascript
// Keepalive per mantenere viva la connessione
const keepaliveInterval = setInterval(() => {
    log('⏳ Mega-batch in elaborazione... (keepalive)', 'info');
}, 5000);
```

## 📡 API Integration

### pdfRest Endpoints
- **Upload:** `POST /upload` - Carica PDF
- **Compile:** `POST /pdf-with-imported-form-data` - Mega-batch compile
- **Info:** `POST /pdf-info` - Analizza struttura PDF
- **Export:** `POST /exported-form-data` - Estrae struttura
- **Convert:** `POST /pdf-with-acroforms` - XFA → Acroforms

### Field Mapping CSV → XFA
```javascript
fieldMapping: {
    'COGNOME': 'cognome',
    'NOME': 'nome', 
    'C.F.': 'codice_fiscale',
    'Qualifica (Q)': 'qualifica',
    'Tipo rapporto': 'rapporto_lavoro',
    'Tipo contratto (TC)': 'contratto_lavoro',
    'N. ore sett. Da contratto': 'n_ore_settimanali',
    'N. sett. Anno': 'n_settimane',
    'N. ore tot.': 'n_ore_totale',
    'di cui straordinari': 'n_ore_straordinarie'
}
```

## 🔍 Troubleshooting Mega-Batch

### Problema: Timeout dopo 45s
**Soluzione:** Attiva modalità fallback
```javascript
// Il sistema rileva automaticamente il timeout e offre fallback
if (error.name === 'TimeoutError') {
    showFallbackOption();
}
```

### Problema: File XML troppo grande
**Soluzione:** Controllo dimensioni
```javascript
// Stima dimensione XML prima dell'invio
function estimateXMLSize(recordCount) {
    const avgFieldSize = 20;
    const fieldsPerRecord = 10;
    return recordCount * fieldsPerRecord * avgFieldSize;
}
```

### Problema: API Key esposta in fallback
**Soluzione:** Exposer temporanea sicura
```javascript
// Warning utente + cancellazione automatica
console.warn('API key temporaneamente esposta per fallback');
// Dopo operazione: key rimossa dal DOM
```

## 📊 Monitoring e Analytics

### Metriche Real-time
- **Record/secondo:** Performance durante elaborazione
- **Dimensione XML:** Monitoraggio memoria
- **Tempo trascorso:** Tracking operazione
- **Strategia attiva:** Single/Mega/Fallback

### Logging Avanzato
```javascript
// Log colorato per diversi tipi operazione
log('🚀 MEGA-BATCH: Tutti i record in una chiamata', 'megabatch');
log('⏳ Mega-batch in elaborazione... (keepalive)', 'info');
log('✅ MEGA-BATCH SUCCESS! 🎉', 'success');
```

## 🛡️ Sicurezza

### API Key Protection
- ✅ **Server-side:** Memorizzata in Netlify Environment
- ✅ **Proxy:** Mai esposta nel browser (modalità normale)
- ⚠️ **Fallback:** Temporaneamente esposta (con warning utente)

### Data Privacy
- ✅ **No Storage:** Dati processati senza persistenza
- ✅ **HTTPS:** Comunicazione criptata end-to-end
- ✅ **Temporary:** File temporanei auto-cancellati

## 🚀 Roadmap Prossimi Sviluppi

### Fase 1: Ottimizzazioni Immediate ✅
- [x] Mega-batch processing (200+ record)
- [x] Fallback automatico
- [x] Progress tracking real-time
- [x] Error handling robusto

### Fase 2: Multi-Tabella Support
- [ ] **Auto-discovery:** Rilevamento automatico tabelle multiple
- [ ] **Mapping Dinamico:** UI drag&drop per mapping campi
- [ ] **Preview:** Anteprima compilazione prima dell'invio

### Fase 3: Enterprise Features
- [ ] **Batch History:** Cronologia elaborazioni
- [ ] **Template Library:** Salvataggio configurazioni
- [ ] **API Propria:** REST endpoint per integrazioni

## 📞 Supporto

### Issues e Bug Report
- **GitHub Issues:** https://github.com/MrSimpleMind/progetto-pdf-compiler/issues
- **Documentazione:** Questo README + documentazione tecnica

### API Provider
- **pdfRest Docs:** https://pdfrest.com/documentation/
- **Support:** https://pdfrest.com/support/
- **Status:** https://status.pdfrest.com/

---

**🎉 La versione Mega-Batch risolve definitivamente il problema dei volumi alti, supportando fino a 200+ record in una singola operazione senza compromessi!**
