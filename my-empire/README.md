# MY EMPIRE 2.0

App personale per abitudini, sport, calendario, voti giornalieri e report settimanale.
TypeScript senza dipendenze a runtime. I dati restano sul dispositivo (IndexedDB) e si esportano come backup JSON.

## Cosa contiene

| Sezione | Cosa fa |
|---|---|
| **Oggi** | Giornata in ordine di orario: attività, promemoria ed eventi. Anello di avanzamento, banner delle dichiarazioni finché non le leggi, voto 1–10 su alimentazione e soldi, pulsante + per aggiungere |
| **Sonno (in Oggi)** | Orari di sonno e risveglio per data del risveglio, durata sugli orari locali (anche oltre mezzanotte), media degli ultimi 7 giorni registrati, storico modificabile ed eliminabile. Incluso nei backup. |
| **Calendario** | Sostituisce il calendario del telefono. Mese con eventi, partite e barra fatto/mancato per giorno; agenda del giorno; eventi ripetuti (giornalieri, settimanali, ogni N giorni, mensili, annuali); promemoria da spuntare |
| **Attività** | 11 attività iniziali, tutte modificabili, più quelle che aggiungi tu. Ognuna ha un calendario: i giorni fatti si accendono (aurora), i mancati sono in negativo (rosso barrato), i saltati in grigio e i previsti tratteggiati. Mostra anche serie, percentuali e andamento su 12 settimane |
| **Basket** | Lunedì, mercoledì e venerdì. Presenze, partite in programma segnate nel calendario e statistiche delle partite (tiri, rimbalzi, assist), oltre al focus tecnico della settimana |
| **Palestra** | Obiettivo 3 volte a settimana. Scheda (giorni, esercizi, serie, ripetizioni), sessioni che si caricano dalla scheda con gli ultimi pesi, grafico dei carichi per esercizio e record |
| **Dichiarazioni** | Lettura quotidiana con conferma "Fatto per oggi" e calendario delle letture |
| **Nutrizione** | Creatina e vitamina D ogni giorno, più il voto su come hai mangiato |
| **Soldi** | Solo un voto giornaliero su come li hai gestiti: nessuna cifra e niente in home |
| **Report** | Settimana per settimana: punteggio, confronto con la precedente, attività, basket, palestra, audiolibro, integratori, voti, consigli e una revisione scritta |
| **Obiettivi** | Traguardi con valore, scadenza e ritmo necessario |
| **Consigli** | 10 buone abitudini da aggiungere una alla volta |
| **Impostazioni** | Nome, notifiche, esportazione `.ics` per il calendario del telefono, giorni di riposo, backup e ripristino |

## Regole sui dati
- **Non registrato ≠ non fatto.** I giorni prima del primo avvio non risultano mai mancati. Un giorno saltato con motivo è grigio, uno dimenticato è rosso.
- **Nessun dato inventato.** Al primo avvio ci sono solo le attività, senza alcuno storico.
- **Annulla** è disponibile dopo ogni registrazione.

## Promemoria su Android
- **Con l'app aperta:** arriva una notifica all'orario impostato, dopo aver installato l'app sulla schermata Home e attivato le notifiche.
- **Con l'app chiusa:** il browser non può svegliare un'app web a un orario preciso. Per questo, da Impostazioni → *Scarica per il calendario (.ics)* si esportano tutti i promemoria ricorrenti, che poi si importano in Google Calendar. Da lì le notifiche arrivano sempre. Se cambi gli orari, scarica di nuovo il file.

## Sviluppo
```bash
npm run typecheck    # TypeScript strict
npm test             # 58 test sul dominio e sui dati
npm run build        # dist/ (da pubblicare) + dist-single/my-empire.html (file unico)
npx http-server dist -p 8080 & npm run e2e   # 27 controlli in Chromium
```

## Struttura
- `src/domain`: regole pure e testate (abitudini, calendario, report, file .ics, sport).
- `src/data`: database, store con annulla e azioni validate.
- `src/ui`: shell, componenti, effetti (particelle, coriandoli, celebrazioni) e viste.
- `src/styles.css`: tema "Mezzanotte" con base blu notte, aurora acqua-viola per ciò che è fatto, oro per traguardi e rosa per ciò che è mancato. Rispetta "riduci movimento".

## Da completare
- Giorno di partenza delle medicine della mamma (ora a giorni alterni da oggi). Si modifica da Attività → Medicine mamma → Imposta.
- Frequenza del bucato (ora 1 volta a settimana).
- Fase 2: sincronizzazione tra dispositivi (Supabase) e repository GitHub.
