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
  { nome: "AGN ENERGIA", pagina: "gestori/agn-energia.html", procedura: "gestori/agn-energia-procedimenti.html" },
  { nome: "ALPERIA", pagina: "gestori/alperia.html", procedura: "gestori/alperia-procedimenti.html" },
  { nome: "AUDAX", pagina: "gestori/audax.html", procedura: "gestori/audax-procedimenti.html" },
  { nome: "AXPO (PULSEE)", pagina: "gestori/axpo.html", procedura: "gestori/axpo-procedimenti.html" },
  { nome: "CHIURLO", pagina: "gestori/chiurlo.html", procedura: "gestori/chiurlo-procedimenti.html" },
  { nome: "COGEME", pagina: "gestori/cogeme.html", procedura: "gestori/cogeme-procedimenti.html" },
  { nome: "DUFERCO", pagina: "gestori/duferco.html", procedura: "gestori/duferco-procedimenti.html" },
  { nome: "EDISON", pagina: "gestori/edison.html", procedura: "gestori/edison-procedimenti.html" },
  { nome: "ENEL CORPORATE", pagina: "gestori/enel-corporate.html", procedura: "gestori/enel-corporate-procedimenti.html" },
  { nome: "ENEL DIGITAL", pagina: "gestori/enel-digital.html", procedura: "gestori/enel-digital-procedimenti.html" },
  { nome: "ENEL TABLET", pagina: "gestori/enel-tablet.html", procedura: "gestori/enel-tablet-procedimenti.html" },
  { nome: "ENGIE", pagina: "gestori/engie.html", procedura: "gestori/engie-procedimenti.html" },
  { nome: "ESTRA", pagina: "gestori/estra.html", procedura: "gestori/estra-procedimenti.html" },
  { nome: "FASTWEB ENERGIA", pagina: "gestori/fastweb-energia.html", procedura: "gestori/fastweb-energia-procedimenti.html" },
  { nome: "GDE", pagina: "gestori/gde.html", procedura: "gestori/gde-procedimenti.html" },
  { nome: "HERA", pagina: "gestori/hera.html", procedura: "gestori/hera-procedimenti.html" },
  { nome: "IREN", pagina: "gestori/iren.html", procedura: "gestori/iren-procedimenti.html" },
  { nome: "MAGIS", pagina: "gestori/magis.html", procedura: "gestori/magis-procedimenti.html" },
  { nome: "ONOVA", pagina: "gestori/onova.html", procedura: "gestori/onova-procedimenti.html" },
  { nome: "PLENITUDE", pagina: "gestori/plenitude.html", procedura: "gestori/plenitude-procedimenti.html" },
  { nome: "S4", pagina: "gestori/s4.html", procedura: "gestori/s4-procedimenti.html" },
  { nome: "SIMECOM", pagina: "gestori/simecom.html", procedura: "gestori/simecom-procedimenti.html" },
  { nome: "SORGENIA", pagina: "gestori/sorgenia.html", procedura: "gestori/sorgenia-procedimenti.html" },
  { nome: "STREAM", pagina: "gestori/stream.html", procedura: "gestori/stream-procedimenti.html" },
  { nome: "UNION", pagina: "gestori/union.html", procedura: "gestori/union-procedimenti.html" },
  { nome: "UNOENERGY", pagina: "gestori/unoenergy.html", procedura: "gestori/unoenergy-procedimenti.html" },
  { nome: "UPENERGY", pagina: "gestori/upenergy.html", procedura: "gestori/upenergy-procedimenti.html" },
  { nome: "VIVIENERGIA", pagina: "gestori/vivienergia.html", procedura: "gestori/vivienergia-procedimenti.html" }
];

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
  },
  {
    gestore: "ENEL TABLET",
    segmenti: ["residenziale", "business", "condominio"],
    commodity: ["luce", "gas", "dual"],
    operazioni: ["switch"],
    pagamenti: ["rid", "bollettino"],
    firme: ["tablet"],
    partner: "Greenworld",
    rid: "Facoltativo",
    impattoGettone: "-5,60 € senza RID",
    storno: "Nessuno storno",
    bollette: "Bimestrali",
    condizioni: [
      "Firma effettuata su tablet",
      "Penale di 50 € se il cliente esce prima del 3° mese"
    ],
    note: "Disponibile esclusivamente per switch.",
    semplicita: 0,
    rapidita: 0,
    valoreGettone: 0,
    prioritaBase: 0,
    aggiornato: "16/07/2026",
    verificato: true
  },
  {
    gestore: "ENGIE",
    segmenti: ["residenziale", "business"],
    commodity: ["luce", "gas", "dual"],
    operazioni: ["switch"],
    pagamenti: ["rid"],
    firme: ["tablet", "otp"],
    partner: "Greenworld",
    rid: "Obbligatorio",
    impattoGettone: "Non applicabile: RID obbligatorio",
    storno: "50% entro 3 mesi",
    bollette: "Luce bimestrale; gas bimestrale fino a 5.000 Smc e mensile oltre 5.000 Smc",
    condizioni: [
      "RID obbligatorio",
      "Disponibile esclusivamente per switch"
    ],
    note: "Firma su tablet oppure tramite OTP.",
    semplicita: 0,
    rapidita: 0,
    valoreGettone: 0,
    prioritaBase: 0,
    aggiornato: "16/07/2026",
    verificato: true
  }
];
