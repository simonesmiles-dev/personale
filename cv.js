// ID del Google Foglio pubblicato (lo stesso della Home, non cambia)
const ID_FOGLIO = "2PACX-1vRZfXT6ycb8Xov1QA7wpY6_Yuz1IhEHuH4Se9QnQdoOPAnWqOnnq6gY-USTRMIkoyP_11W0n7Uaiav4";

// Numero del tab "CV": lo trovi nel link che dà Google dopo gid=
const GID_CV = "210809897";

// Link CSV del tab "CV"
const URL_CV = "https://docs.google.com/spreadsheets/d/e/" + ID_FOGLIO + "/pub?gid=" + GID_CV + "&single=true&output=csv";

// ---------- FUNZIONI PER LEGGERE IL FOGLIO (le stesse della Home) ----------

// Scarica il CSV e lo trasforma in una lista di oggetti
async function leggiFoglio(url) {
  const risposta = await fetch(url);
  if (!risposta.ok) {
    throw new Error("Errore nel download: " + risposta.status);
  }
  const testo = await risposta.text();
  return csvInOggetti(testo);
}

// Trasforma il testo CSV in oggetti: la prima riga contiene i nomi delle colonne
function csvInOggetti(testo) {
  const righe = [];
  let riga = [];
  let cella = "";
  let traVirgolette = false;

  // Leggo il testo un carattere alla volta
  for (const c of testo) {
    if (c === '"') {
      traVirgolette = !traVirgolette;      // entro/esco da un testo tra virgolette
    } else if (c === "," && !traVirgolette) {
      riga.push(cella);                    // fine cella
      cella = "";
    } else if (c === "\n" && !traVirgolette) {
      riga.push(cella);                    // fine riga
      righe.push(riga);
      riga = [];
      cella = "";
    } else if (c !== "\r") {
      cella += c;                          // carattere normale
    }
  }
  riga.push(cella);                        // ultima riga
  righe.push(riga);

  const intestazioni = righe[0].map(nome => nome.trim());
  const oggetti = [];
  for (let i = 1; i < righe.length; i++) {
    const oggetto = {};
    intestazioni.forEach((nome, posizione) => {
      oggetto[nome] = (righe[i][posizione] || "").trim();
    });
    oggetti.push(oggetto);
  }
  return oggetti;
}

// Mostra un messaggio d'errore al posto della pagina vuota
function mostraErrore(messaggio) {
  const box = document.getElementById("messaggio-errore");
  box.textContent = messaggio;
  box.hidden = false;
}

// ---------- RENDERING DEL CV ----------

// Crea un paragrafo solo se il testo non è vuoto
function aggiungiParagrafo(contenitore, tag, classe, valore) {
  if (!valore) return;                     // cella vuota: non mostro niente
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  elemento.textContent = valore;
  contenitore.appendChild(elemento);
}

// Informazioni personali: "Nome informazione: valore"
function mostraDati(righe) {
  const contenitore = document.getElementById("lista-dati");
  righe.forEach(r => {
    if (!r.titolo || !r.testo) return;     // senza nome o senza valore salto la riga

    const p = document.createElement("p");
    p.className = "dato";

    const nome = document.createElement("strong");
    nome.textContent = r.titolo + ": ";

    const valore = document.createElement("span");
    valore.textContent = r.testo;

    p.append(nome, valore);
    contenitore.appendChild(p);
  });
}

// Istruzione ed esperienze hanno gli stessi campi, quindi uso la stessa funzione
function mostraVoci(righe, idContenitore) {
  const contenitore = document.getElementById(idContenitore);
  righe.forEach(r => {
    const voce = document.createElement("div");
    voce.className = "voce";

    aggiungiParagrafo(voce, "h3", "", r.titolo);
    aggiungiParagrafo(voce, "p", "sottotitolo", r.sottotitolo);
    aggiungiParagrafo(voce, "p", "periodo", r.periodo);
    aggiungiParagrafo(voce, "p", "", r.testo);

    if (voce.children.length > 0) {        // aggiungo la voce solo se ha qualcosa dentro
      contenitore.appendChild(voce);
    }
  });
}

// Se un blocco non ha nessun contenuto, nascondo anche il suo titolo
function nascondiBloccoVuoto(idBlocco, idLista) {
  const lista = document.getElementById(idLista);
  if (lista.children.length === 0) {
    document.getElementById(idBlocco).hidden = true;
  }
}

function mostraCV(dati) {
  mostraDati(dati.filter(r => r.sezione === "dati"));
  mostraVoci(dati.filter(r => r.sezione === "istruzione"), "lista-istruzione");
  mostraVoci(dati.filter(r => r.sezione === "esperienza"), "lista-esperienza");

  nascondiBloccoVuoto("blocco-dati", "lista-dati");
  nascondiBloccoVuoto("blocco-istruzione", "lista-istruzione");
  nascondiBloccoVuoto("blocco-esperienza", "lista-esperienza");
}

// ---------- AVVIO ----------

async function avvia() {
  try {
    const dati = await leggiFoglio(URL_CV);
    mostraCV(dati);
  } catch (errore) {
    mostraErrore("Non riesco a caricare i contenuti. Controlla che il foglio sia pubblicato.");
    console.error(errore);
  }
}

avvia();