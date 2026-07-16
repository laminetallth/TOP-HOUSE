/*
 * TOP HOUSE — Dati del motore "Trova il gestore"
 *
 * IMPORTANTE:
 * - L'elenco sotto contiene soltanto i gestori presenti nel Drive.
 * - A2A è volutamente esclusa.
 * - Le condizioni commerciali NON sono inventate.
 * - Aggiungere una regola in TOP_HOUSE_REGOLE solo dopo averla verificata.
 */

window.TOP_HOUSE_GESTORI = [
  { nome: "ACEA", pagina: "gestori/acea.html", procedura: "gestori/acea-procedimenti.html" },
  { nome: "ALPERIA", pagina: "gestori/alperia.html", procedura: "gestori/alperia-procedimenti.html" },
  { nome: "COGEME", pagina: "gestori/cogeme.html", procedura: "gestori/cogeme-procedimenti.html" },
  { nome: "DUFERCO", pagina: "gestori/duferco.html", procedura: "gestori/duferco-procedimenti.html" },
  { nome: "ENEL", pagina: "gestori/enel.html", procedura: "gestori/enel-procedimenti.html" },
  { nome: "ENGIE", pagina: "gestori/engie.html", procedura: "gestori/engie-procedimenti.html" },
  { nome: "GDE", pagina: "gestori/gde.html", procedura: "gestori/gde-procedimenti.html" },
  { nome: "HERA", pagina: "gestori/hera.html", procedura: "gestori/hera-procedimenti.html" },
  { nome: "IREN", pagina: "gestori/iren.html", procedura: "gestori/iren-procedimenti.html" },
  { nome: "ONOVA", pagina: "gestori/onova.html", procedura: "gestori/onova-procedimenti.html" },
  { nome: "S4", pagina: "gestori/s4.html", procedura: "gestori/s4-procedimenti.html" },
  { nome: "SIMECOM", pagina: "gestori/simecom.html", procedura: "gestori/simecom-procedimenti.html" },
  { nome: "SORGENIA", pagina: "gestori/sorgenia.html", procedura: "gestori/sorgenia-procedimenti.html" },
  { nome: "STREAM", pagina: "gestori/stream.html", procedura: "gestori/stream-procedimenti.html" },
  { nome: "UNION", pagina: "gestori/union.html", procedura: "gestori/union-procedimenti.html" },
  { nome: "UNOENERGY", pagina: "gestori/unoenergy.html", procedura: "gestori/unoenergy-procedimenti.html" },
  { nome: "VIVIENERGIA", pagina: "gestori/vivienergia.html", procedura: "gestori/vivienergia-procedimenti.html" }
];

/*
 * STRUTTURA DI UNA REGOLA VERIFICATA
 *
 * {
 *   gestore: "DUFERCO",
 *   segmenti: ["business"],
 *   commodity: ["luce", "gas", "dual"],
 *   operazioni: ["switch", "voltura", "subentro", "nuova-attivazione", "prima-attivazione"],
 *   pagamenti: ["rid", "bollettino"],
 *   firme: ["otp", "cartacea"],
 *   partner: "Greenworld",
 *   rid: "Facoltativo",
 *   impattoGettone: "Nessuna riduzione",
 *   storno: "100% entro 3 mesi; 50% dal 4° al 5° mese",
 *   bollette: "Mensile",
 *   condizioni: ["Eventuale condizione reale e verificata"],
 *   note: "Nota operativa breve",
 *   semplicita: 1,
 *   rapidita: 1,
 *   valoreGettone: 1,
 *   prioritaBase: 0,
 *   aggiornato: "16/07/2026",
 *   verificato: true
 * }
 */

window.TOP_HOUSE_REGOLE = [
  {
    gestore: "DUFERCO",
    segmenti: ["residenziale", "business", "condominio"],
    commodity: ["luce", "gas", "dual"],
    operazioni: ["switch", "voltura", "subentro", "nuova-attivazione", "prima-attivazione"],
    pagamenti: ["rid", "bollettino"],
    firme: ["otp", "cartacea"],
    partner: "Greenworld",
    rid: "Facoltativo: RID e bollettino hanno le stesse condizioni",
    impattoGettone: "Nessuna riduzione senza RID",
    storno: "100% entro 3 mesi; 50% dal 4° al 5° mese",
    bollette: "Mensili",
    condizioni: [],
    note: "",
    semplicita: 0,
    rapidita: 0,
    valoreGettone: 0,
    prioritaBase: 0,
    aggiornato: "16/07/2026",
    verificato: true
  }
];