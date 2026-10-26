# Contratti dei partner → Regia Control (CRM Top House)

Richiesta di Lamine Tall (amministrazione Top House), 26/10/2026: ogni contratto caricato da oggi in poi su
PromUp, CRM GreenWorld o CRM BWC va importato in automatico su Regia Control come opportunità.

## Regole
- Pipeline **01 - Rete Vendita**, fase **Vinto**, stato vinta.
- Se il contratto va in **KO** sul portale del partner, l'opportunità passa in **Perso** (persa).
- Dati del cliente compilati bene nel contatto: nome e cognome (o ragione sociale), email, cellulare, indirizzo, CAP,
  città, provincia, data di nascita, codice fiscale (campo personalizzato), fornitore, data firma, nome offerta;
  etichette "bolletta luce", "bolletta gas", "rid", "business"; azienda = "<Partner> <Gestore>" (es. "Prom-up Enel").
- Venditore trovato tra gli utenti di Regia → assegnato all'opportunità e **fonte "passaparola"**.
  Venditore non presente su Regia → **fonte = nome del venditore** (es. "Dardan Gashi").
  Nessun venditore (contratto caricato dall'agenzia) → fonte "PromUp (agenzia)" / "GreenWorld (agenzia)" / "BWC (agenzia)".
- Si importano solo i contratti inseriti dal **2026-10-26** in poi.
- Niente doppioni: il nome dell'opportunità finisce con "(PromUp 258790)" / "(GreenWorld 278173)" / "(BWC …)".
  Se il cliente ha già un'opportunità creata a mano negli ultimi giorni nella stessa pipeline, non se ne crea un'altra.
- Contatti già esistenti (stessa email o stesso telefono): si completano solo i dati mancanti e si aggiungono le etichette.

## File
- `leggi-promup.js` → `leggiPromup(DAL, GIA)` nella scheda https://promup.sharework.it/web/agenzia.php
- `leggi-greenworld.js` → `leggiGreenworld(DAL, GIA)` in una scheda https://crmgreenworld.com/contratti
- `leggi-bwc.js` → `leggiBwc(DAL, GIA)` nella scheda https://bwccrm.it/tracking.php
- `scrivi-regia.js` → `installaHook()`, `elencoImportati()`, `sincronizzaRegia(contratti)` nella scheda
  https://app.regia-control.it/v2/location/XzcvYtDjrqAP8tyvw3rp/opportunities

Per caricarli in una scheda (le pagine permettono eval):
```js
(0, eval)(await (await fetch('https://raw.githubusercontent.com/laminetallth/TOP-HOUSE/main/automazioni/crm/<file>.js?t=' + Date.now())).text()
  + ';window.<funzione>=<funzione>;')
```

## Procedura di ogni controllo
1. **Regia**: apri la pipeline, carica `scrivi-regia.js`, esegui `installaHook()`, poi scrivi una lettera nel box
   "Cerca lead" (e cancellala): così la pagina manda una richiesta e il token di sessione viene catturato.
   `await elencoImportati()` → `{promup: {id: stato}, greenworld: {...}, bwc: {...}}` (contratti già importati).
2. **Partner**: in ogni scheda carica il lettore ed esegui `await leggiX('2026-10-26', GIA_di_quel_partner)`.
   Restituisce solo i contratti da lavorare (nuovi, oppure andati in KO e non ancora persi). Se il JSON è lungo,
   leggilo a pezzi (`.slice(0, 3000)`, `.slice(3000, 6000)`, …) e ricomponilo.
3. **Regia**: `await sincronizzaRegia(contratti)` (con `true` come secondo parametro fa una prova senza scrivere).
4. Riepilogo per Lamine: opportunità create (cliente, gestore, partner, venditore/fonte), spostate in Perso, errori.
   Se non c'è niente da fare: nessuna notifica.

## Accessi
- PromUp, BWC, Regia: restano loggati nel Chrome del PC.
- CRM GreenWorld: l'accesso vale solo nella scheda del login e dura 8 ore. `leggiGreenworld` lo copia in
  localStorage (chiave `th_gw_crm_token`) così le schede dei controlli automatici lo possono usare finché è valido.
  Se risponde `LOGIN_GREENWORLD`, Lamine deve rifare il login sul CRM GreenWorld e poi usare il segnalibro
  "Salva accesso GW per Claude" (vedi sotto) oppure scrivere a Claude "ho fatto il login su GreenWorld".
- Non inserire mai password.

Segnalibro "Salva accesso GW per Claude" (da cliccare nella scheda del CRM GreenWorld dopo il login):
```
javascript:(()=>{const t=sessionStorage.getItem('gw_crm_token');if(t){localStorage.setItem('th_gw_crm_token',t);alert('Accesso salvato per gli aggiornamenti automatici (vale 8 ore)')}else alert('Prima fai il login')})()
```
