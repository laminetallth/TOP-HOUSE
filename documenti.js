// Elenco documenti TOP HOUSE.
//
// Qui NON si caricano i PDF: i file restano dove sono già stati caricati
// (Firebase Storage/documenti o GitHub). Qui si inseriscono solo i link.
//
// Per collegare un PDF alla pagina corretta compila una voce come questa:
// {
//   gestore: "a2a",              // data-gestore della pagina
//   sezione: "cte",              // data-sezione della pagina (alias: categoria)
//   tipo: "residenziale",        // data-tipo della pagina (alias: sottocategoria)
//   titolo: "Nome documento PDF",
//   url: "https://firebasestorage.googleapis.com/..."
// }
//
// Sono supportati anche i nomi richiesti "categoria", "sottocategoria" e "link":
// { gestore: "a2a", categoria: "cte", sottocategoria: "residenziale", titolo: "...", link: "..." }
const DOCUMENTI = [
  // Inserisci qui i PDF già caricati. Esempio:
  // {
  //   gestore: "a2a",
  //   sezione: "cte",
  //   tipo: "residenziale",
  //   titolo: "CTE A2A Residenziale",
  //   url: "https://firebasestorage.googleapis.com/v0/b/top-house-4bb50.firebasestorage.app/o/documenti%2FCTE-A2A-Residenziale.pdf?alt=media&token=..."
  // }
];

window.DOCUMENTI = DOCUMENTI;
