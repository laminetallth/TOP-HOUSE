(() => {
  "use strict";

  const gestori = Array.isArray(window.TOP_HOUSE_GESTORI) ? window.TOP_HOUSE_GESTORI : [];
  const regole = Array.isArray(window.TOP_HOUSE_REGOLE) ? window.TOP_HOUSE_REGOLE : [];

  const labels = {
    segmento: { residenziale: "Residenziale", business: "Business", condominio: "Condominio" },
    commodity: { luce: "Luce", gas: "Gas", dual: "Luce e gas" },
    operazione: {
      switch: "Switch",
      voltura: "Voltura",
      subentro: "Subentro",
      "nuova-attivazione": "Nuova attivazione",
      "prima-attivazione": "Prima attivazione"
    },
    pagamento: { rid: "RID", bollettino: "Bollettino", indifferente: "Indifferente" },
    firma: { otp: "OTP", cartacea: "Cartacea", entrambe: "Entrambe", indifferente: "Indifferente" },
    priorita: {
      semplice: "Procedura semplice",
      rapida: "Attivazione rapida",
      "no-rid": "Pagamento senza RID",
      otp: "Firma OTP",
      compenso: "Migliore compenso",
      nessuna: "Nessuna preferenza"
    }
  };

  const questions = [
    {
      key: "segmento",
      label: "Tipologia cliente",
      title: "Per quale tipologia di cliente stai inserendo la pratica?",
      help: "La disponibilità può cambiare tra residenziale, business e condominio.",
      icon: "fa-user",
      options: [
        { value: "residenziale", title: "Residenziale", text: "Privato o abitazione", icon: "fa-house" },
        { value: "business", title: "Business", text: "Azienda, negozio o professionista", icon: "fa-briefcase" },
        { value: "condominio", title: "Condominio", text: "Fornitura intestata al condominio", icon: "fa-building" }
      ]
    },
    {
      key: "commodity",
      label: "Fornitura",
      title: "Quale fornitura serve al cliente?",
      help: "Puoi cercare una fornitura singola oppure luce e gas insieme.",
      icon: "fa-bolt",
      options: [
        { value: "luce", title: "Luce", text: "Solo energia elettrica", icon: "fa-bolt" },
        { value: "gas", title: "Gas", text: "Solo fornitura gas", icon: "fa-fire-flame-simple" },
        { value: "dual", title: "Luce e gas", text: "Entrambe le forniture", icon: "fa-layer-group" }
      ]
    },
    {
      key: "operazione",
      label: "Operazione",
      title: "Quale operazione devi effettuare?",
      help: "Se non sei sicuro, il sistema ti aiuta a riconoscerla.",
      icon: "fa-shuffle",
      options: [
        { value: "switch", title: "Switch", text: "Cambio gestore con contatore attivo", icon: "fa-right-left" },
        { value: "voltura", title: "Voltura", text: "Cambio intestatario con contatore attivo", icon: "fa-user-pen" },
        { value: "subentro", title: "Subentro", text: "Riattivazione di un contatore già utilizzato", icon: "fa-power-off" },
        { value: "nuova-attivazione", title: "Nuova attivazione", text: "Il contatore non è ancora presente", icon: "fa-plug-circle-plus" },
        { value: "prima-attivazione", title: "Prima attivazione", text: "Contatore presente ma mai attivato", icon: "fa-circle-play" },
        { value: "non-so", title: "Non lo so", text: "Rispondi a tre domande guidate", icon: "fa-circle-question" }
      ]
    },
    {
      key: "pagamento",
      label: "Pagamento",
      title: "Il cliente è disponibile ad attivare il RID?",
      help: "La risposta può escludere i gestori che accettano soltanto l’addebito diretto.",
      icon: "fa-credit-card",
      options: [
        { value: "rid", title: "Sì, RID", text: "Addebito sul conto corrente", icon: "fa-building-columns" },
        { value: "bollettino", title: "No, bollettino", text: "Il cliente non vuole il RID", icon: "fa-receipt" },
        { value: "indifferente", title: "È indifferente", text: "Entrambe le modalità vanno bene", icon: "fa-arrows-left-right" }
      ]
    },
    {
      key: "firma",
      label: "Firma",
      title: "Come può firmare il cliente?",
      help: "Scegli la modalità realmente utilizzabile dal cliente.",
      icon: "fa-file-signature",
      options: [
        { value: "otp", title: "OTP", text: "Firma tramite codice ricevuto dal cliente", icon: "fa-mobile-screen-button" },
        { value: "cartacea", title: "Cartacea", text: "Contratto stampato e firmato", icon: "fa-pen-nib" },
        { value: "entrambe", title: "Entrambe", text: "OTP oppure firma cartacea", icon: "fa-layer-group" },
        { value: "indifferente", title: "È indifferente", text: "Nessuna preferenza di firma", icon: "fa-arrows-left-right" }
      ]
    },
    {
      key: "priorita",
      label: "Priorità",
      title: "Qual è la priorità principale per questa pratica?",
      help: "Questa scelta ordina i risultati, ma non esclude gestori compatibili.",
      icon: "fa-ranking-star",
      options: [
        { value: "semplice", title: "Procedura semplice", text: "Meno passaggi e meno vincoli", icon: "fa-wand-magic-sparkles" },
        { value: "rapida", title: "Attivazione rapida", text: "Preferisci tempi operativi più brevi", icon: "fa-stopwatch" },
        { value: "no-rid", title: "Pagamento senza RID", text: "Priorità ai gestori che accettano il bollettino", icon: "fa-receipt" },
        { value: "otp", title: "Firma OTP", text: "Priorità alla firma digitale", icon: "fa-mobile-screen-button" },
        { value: "compenso", title: "Migliore compenso", text: "Ordina in base al valore relativo del gettone", icon: "fa-euro-sign" },
        { value: "nessuna", title: "Nessuna preferenza", text: "Mostra prima la compatibilità generale", icon: "fa-equals" }
      ]
    }
  ];

  const state = {
    step: 0,
    answers: {},
    diagnostic: { contatorePresente: null, contatoreAttivo: null, intestatoCliente: null, maiAttivato: null }
  };

  const elements = {
    intro: document.getElementById("introScreen"), wizard: document.getElementById("wizardScreen"), results: document.getElementById("resultsScreen"),
    start: document.getElementById("startButton"), previous: document.getElementById("previousButton"), backBottom: document.getElementById("backBottomButton"),
    next: document.getElementById("nextButton"), restart: document.getElementById("restartButton"), newSearch: document.getElementById("newSearchButton"),
    editAnswers: document.getElementById("editAnswersButton"), counter: document.getElementById("stepCounter"), percent: document.getElementById("progressPercent"),
    bar: document.getElementById("progressBar"), icon: document.getElementById("questionIcon"), label: document.getElementById("questionLabel"),
    title: document.getElementById("questionTitle"), help: document.getElementById("questionHelp"), grid: document.getElementById("answersGrid"),
    diagnostic: document.getElementById("diagnosticArea"), summary: document.getElementById("selectionSummary"), notice: document.getElementById("configurationNotice"),
    list: document.getElementById("resultsList"), excludedPanel: document.getElementById("excludedPanel"), excludedList: document.getElementById("excludedList"),
    resultsSubtitle: document.getElementById("resultsSubtitle")
  };

  function showScreen(screen) {
    elements.intro.hidden = screen !== "intro";
    elements.wizard.hidden = screen !== "wizard";
    elements.results.hidden = screen !== "results";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDiagnostic() {
    state.diagnostic = { contatorePresente: null, contatoreAttivo: null, intestatoCliente: null, maiAttivato: null };
  }

  function resetAll() {
    state.step = 0;
    state.answers = {};
    resetDiagnostic();
    showScreen("intro");
  }

  function renderQuestion() {
    const question = questions[state.step];
    const progress = Math.round(((state.step + 1) / questions.length) * 100);
    elements.counter.textContent = `Domanda ${state.step + 1} di ${questions.length}`;
    elements.percent.textContent = `${progress}%`;
    elements.bar.style.width = `${progress}%`;
    elements.icon.innerHTML = `<i class="fa-solid ${question.icon}"></i>`;
    elements.label.textContent = question.label;
    elements.title.textContent = question.title;
    elements.help.textContent = question.help;

    elements.grid.innerHTML = question.options.map(option => {
      const selected = state.answers[question.key] === option.value;
      return `<button class="answer-option${selected ? " is-selected" : ""}" type="button" data-value="${option.value}">
        <span class="answer-icon"><i class="fa-solid ${option.icon}"></i></span>
        <span class="answer-copy"><strong>${option.title}</strong><small>${option.text}</small></span>
      </button>`;
    }).join("");

    elements.grid.querySelectorAll(".answer-option").forEach(button => {
      button.addEventListener("click", () => selectAnswer(question, button.dataset.value));
    });

    renderDiagnostic();
    updateNavigation();
  }

  function selectAnswer(question, value) {
    state.answers[question.key] = value;
    if (question.key === "operazione") {
      delete state.answers.operazioneRisolta;
      resetDiagnostic();
    }
    renderQuestion();
  }

  function renderDiagnostic() {
    const isOperationStep = questions[state.step].key === "operazione";
    const needsDiagnostic = state.answers.operazione === "non-so";
    elements.diagnostic.hidden = !(isOperationStep && needsDiagnostic);
    if (!isOperationStep || !needsDiagnostic) {
      elements.diagnostic.innerHTML = "";
      return;
    }

    const d = state.diagnostic;
    let html = "";
    if (d.contatorePresente === null) {
      html = diagnosticBlock("Il contatore è già presente?", "contatorePresente", [["si", "Sì"], ["no", "No"]]);
    } else if (d.contatorePresente === "no") {
      state.answers.operazioneRisolta = "nuova-attivazione";
      html = diagnosticResult("L’operazione individuata è: Nuova attivazione");
    } else if (d.contatoreAttivo === null) {
      html = diagnosticBlock("Il contatore è attualmente attivo?", "contatoreAttivo", [["si", "Sì"], ["no", "No"]]);
    } else if (d.contatoreAttivo === "si" && d.intestatoCliente === null) {
      html = diagnosticBlock("L’utenza è già intestata al cliente?", "intestatoCliente", [["si", "Sì"], ["no", "No"]]);
    } else if (d.contatoreAttivo === "si") {
      state.answers.operazioneRisolta = d.intestatoCliente === "si" ? "switch" : "voltura";
      html = diagnosticResult(`L’operazione individuata è: ${labels.operazione[state.answers.operazioneRisolta]}`);
    } else if (d.maiAttivato === null) {
      html = diagnosticBlock("Il contatore è già stato utilizzato in passato?", "maiAttivato", [["si", "Sì"], ["no", "No"]]);
    } else {
      state.answers.operazioneRisolta = d.maiAttivato === "si" ? "subentro" : "prima-attivazione";
      html = diagnosticResult(`L’operazione individuata è: ${labels.operazione[state.answers.operazioneRisolta]}`);
    }

    elements.diagnostic.innerHTML = html;
    elements.diagnostic.querySelectorAll("[data-diagnostic-key]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.diagnosticKey;
        const value = button.dataset.value;
        delete state.answers.operazioneRisolta;
        if (value === "") {
          resetDiagnostic();
          renderQuestion();
          return;
        }
        state.diagnostic[key] = value;
        if (key === "contatorePresente") {
          state.diagnostic.contatoreAttivo = null;
          state.diagnostic.intestatoCliente = null;
          state.diagnostic.maiAttivato = null;
        }
        if (key === "contatoreAttivo") {
          state.diagnostic.intestatoCliente = null;
          state.diagnostic.maiAttivato = null;
        }
        renderQuestion();
      });
    });
  }

  function diagnosticBlock(title, key, options) {
    return `<h3 class="diagnostic-title">${title}</h3><div class="diagnostic-options">${options.map(([value, label]) =>
      `<button class="diagnostic-button" type="button" data-diagnostic-key="${key}" data-value="${value}">${label}</button>`
    ).join("")}</div>`;
  }

  function diagnosticResult(text) {
    return `<h3 class="diagnostic-title">Operazione riconosciuta</h3>
      <p class="diagnostic-result"><i class="fa-solid fa-circle-check"></i> ${text}</p>
      <button class="diagnostic-button" type="button" data-diagnostic-key="contatorePresente" data-value="">Ricomincia la verifica</button>`;
  }

  function currentAnswerIsValid() {
    const question = questions[state.step];
    const value = state.answers[question.key];
    if (!value) return false;
    if (question.key === "operazione" && value === "non-so") return Boolean(state.answers.operazioneRisolta);
    return true;
  }

  function updateNavigation() {
    elements.previous.disabled = state.step === 0;
    elements.backBottom.style.visibility = state.step === 0 ? "hidden" : "visible";
    elements.next.disabled = !currentAnswerIsValid();
    elements.next.innerHTML = state.step === questions.length - 1
      ? `Mostra risultati <i class="fa-solid fa-wand-magic-sparkles"></i>`
      : `Continua <i class="fa-solid fa-arrow-right"></i>`;
  }

  function nextStep() {
    if (!currentAnswerIsValid()) return;
    if (state.step < questions.length - 1) {
      state.step += 1;
      renderQuestion();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      renderResults();
      showScreen("results");
    }
  }

  function previousStep() {
    if (state.step === 0) return;
    state.step -= 1;
    renderQuestion();
  }

  function resolvedOperation() {
    return state.answers.operazione === "non-so" ? state.answers.operazioneRisolta : state.answers.operazione;
  }

  function arrayHas(list, value) { return Array.isArray(list) && list.includes(value); }

  function commodityMatches(ruleCommodity, requested) {
    if (!Array.isArray(ruleCommodity)) return false;
    if (requested !== "dual") return ruleCommodity.includes(requested) || ruleCommodity.includes("dual");
    return ruleCommodity.includes("dual") || (ruleCommodity.includes("luce") && ruleCommodity.includes("gas"));
  }

  function compatibility(rule) {
    const reasons = [];
    const operation = resolvedOperation();
    if (!rule || rule.verificato !== true) reasons.push("Regola non verificata");
    if (!arrayHas(rule.segmenti, state.answers.segmento)) reasons.push("Tipologia cliente non ammessa");
    if (!commodityMatches(rule.commodity, state.answers.commodity)) reasons.push("Fornitura non ammessa");
    if (!arrayHas(rule.operazioni, operation)) reasons.push("Operazione non disponibile");
    if (state.answers.pagamento !== "indifferente" && !arrayHas(rule.pagamenti, state.answers.pagamento)) {
      reasons.push(state.answers.pagamento === "bollettino" ? "Bollettino non accettato" : "RID non disponibile");
    }
    if (!["indifferente", "entrambe"].includes(state.answers.firma) && !arrayHas(rule.firme, state.answers.firma)) {
      reasons.push(`Firma ${labels.firma[state.answers.firma]} non disponibile`);
    }
    if (state.answers.firma === "entrambe" && !(arrayHas(rule.firme, "otp") && arrayHas(rule.firme, "cartacea"))) {
      reasons.push("Non sono disponibili entrambe le modalità di firma");
    }
    return reasons;
  }

  function scoreRule(rule) {
    let score = Number(rule.prioritaBase || 0) + 40 - Math.min((rule.condizioni || []).length, 3) * 2;
    switch (state.answers.priorita) {
      case "semplice": score += Number(rule.semplicita || 0) * 4; break;
      case "rapida": score += Number(rule.rapidita || 0) * 4; break;
      case "no-rid": score += arrayHas(rule.pagamenti, "bollettino") ? 15 : 0; break;
      case "otp": score += arrayHas(rule.firme, "otp") ? 15 : 0; break;
      case "compenso": score += Number(rule.valoreGettone || 0) * 4; break;
      default: score += Number(rule.semplicita || 0) + Number(rule.rapidita || 0);
    }
    return score;
  }

  function renderResults() {
    const configuredRules = regole.filter(rule => rule && rule.verificato === true);
    const compatible = [];
    const excluded = [];
    configuredRules.forEach(rule => {
      const manager = gestori.find(item => item.nome === rule.gestore);
      if (!manager) return;
      const reasons = compatibility(rule);
      if (reasons.length === 0) compatible.push({ rule, manager, score: scoreRule(rule) });
      else excluded.push({ rule, manager, reasons });
    });
    compatible.sort((a, b) => b.score - a.score || a.manager.nome.localeCompare(b.manager.nome, "it"));

    renderSummary();
    elements.notice.hidden = configuredRules.length > 0;
    elements.list.innerHTML = compatible.map((item, index) => resultCard(item, index)).join("");
    if (configuredRules.length === 0) elements.resultsSubtitle.textContent = "Il percorso è pronto; mancano soltanto le condizioni commerciali verificate.";
    else if (compatible.length === 0) elements.resultsSubtitle.textContent = "Nessun gestore configurato rispetta tutte le condizioni selezionate.";
    else elements.resultsSubtitle.textContent = `${compatible.length} ${compatible.length === 1 ? "gestore compatibile trovato" : "gestori compatibili trovati"}.`;

    elements.excludedPanel.hidden = excluded.length === 0;
    elements.excludedList.innerHTML = excluded.map(item => `<div class="excluded-row"><strong>${item.manager.nome}</strong><span>${item.reasons.join(" · ")}</span></div>`).join("");
  }

  function renderSummary() {
    const operation = resolvedOperation();
    const items = [
      ["fa-user", labels.segmento[state.answers.segmento]], ["fa-bolt", labels.commodity[state.answers.commodity]],
      ["fa-shuffle", labels.operazione[operation]], ["fa-credit-card", labels.pagamento[state.answers.pagamento]],
      ["fa-file-signature", labels.firma[state.answers.firma]], ["fa-ranking-star", labels.priorita[state.answers.priorita]]
    ];
    elements.summary.innerHTML = items.map(([icon, text]) => `<span class="summary-chip"><i class="fa-solid ${icon}"></i>${text}</span>`).join("");
  }

  function resultCard(item, index) {
    const { rule, manager } = item;
    const conditions = Array.isArray(rule.condizioni) ? rule.condizioni : [];
    const reason = conditions.length ? `Compatibile con la pratica. Condizioni: ${conditions.join("; ")}.` : "Compatibile con tutte le condizioni selezionate.";
    const details = [
      rule.partner ? `Partner: ${rule.partner}` : "", rule.rid ? `RID: ${rule.rid}` : "",
      rule.impattoGettone ? `Gettone: ${rule.impattoGettone}` : "", rule.storno ? `Storno: ${rule.storno}` : "",
      rule.bollette ? `Bollette: ${rule.bollette}` : "", rule.aggiornato ? `Aggiornato: ${rule.aggiornato}` : ""
    ].filter(Boolean);

    return `<article class="result-card${index === 0 ? " is-best" : ""}"><div>
      <span class="result-rank"><i class="fa-solid ${index === 0 ? "fa-crown" : "fa-circle-check"}"></i>${index === 0 ? "Gestore consigliato" : "Alternativa compatibile"}</span>
      <div class="result-heading"><h2>${manager.nome}</h2><span class="status-badge">${conditions.length ? "Con condizioni" : "Compatibile"}</span></div>
      <p class="result-reason">${reason}</p><div class="result-details">${details.map(detail => `<span class="detail-chip">${detail}</span>`).join("")}</div>
      </div><div class="result-actions"><a class="manager-link" href="${manager.pagina}">Apri ${manager.nome}<i class="fa-solid fa-arrow-right"></i></a>
      ${manager.procedura ? `<a class="procedure-link" href="${manager.procedura}">Procedura<i class="fa-solid fa-file-lines"></i></a>` : ""}</div></article>`;
  }

  elements.start.addEventListener("click", () => { showScreen("wizard"); renderQuestion(); });
  elements.next.addEventListener("click", nextStep);
  elements.previous.addEventListener("click", previousStep);
  elements.backBottom.addEventListener("click", previousStep);
  elements.restart.addEventListener("click", resetAll);
  elements.newSearch.addEventListener("click", resetAll);
  elements.editAnswers.addEventListener("click", () => { state.step = 0; showScreen("wizard"); renderQuestion(); });
  document.addEventListener("keydown", event => {
    if (elements.wizard.hidden) return;
    if (event.key === "Enter" && !elements.next.disabled) nextStep();
    if (event.key === "Escape" && state.step > 0) previousStep();
  });
})();
