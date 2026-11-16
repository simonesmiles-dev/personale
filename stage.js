// ID del Google Foglio pubblicato (lo stesso della Home, non cambia)
const ID_FOGLIO = "2PACX-1vRZfXT6ycb8Xov1QA7wpY6_Yuz1IhEHuH4Se9QnQdoOPAnWqOnnq6gY-USTRMIkoyP_11W0n7Uaiav4";

// Numero del tab "Stage": lo trovi nel link che dà Google dopo gid=
const GID_STAGE = "1216334234";

// Link CSV del tab "Stage"
const URL_STAGE = "https://docs.google.com/spreadsheets/d/e/" + ID_FOGLIO + "/pub?gid=" + GID_STAGE + "&single=true&output=csv";

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

// ---------- RENDERING DEGLI STAGE ----------

// Crea un elemento con del testo e lo aggiunge, ma solo se il testo non è vuoto
function aggiungiTesto(contenitore, tag, classe, valore) {
  if (!valore) return;                     // cella vuota: non mostro niente
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  elemento.textContent = valore;
  contenitore.appendChild(elemento);
}

// Crea la card con immagine, azienda, luogo, settore e attività
function creaCard(r) {
  const card = document.createElement("div");
  card.className = "card";

  // Immagine: la creo solo se nella cella c'è il nome del file
  if (r.immagine) {
    const img = document.createElement("img");
    img.src = "img/" + r.immagine;
    img.alt = r.azienda;
    card.appendChild(img);
  }

  aggiungiTesto(card, "h3", "", r.azienda);
  aggiungiTesto(card, "p", "", r.luogo);
  aggiungiTesto(card, "p", "", r.settore);

  // Attività: divido il testo ai punti e virgola e tolgo gli spazi in più
  const punti = r.attivita
    .split(";")
    .map(punto => punto.trim())
    .filter(punto => punto !== "");        // scarto i pezzi vuoti

  if (punti.length > 0) {
    aggiungiTesto(card, "h4", "", "Di cosa si occupa");
    const elenco = document.createElement("ul");
    punti.forEach(punto => {
      const li = document.createElement("li");
      li.textContent = punto;
      elenco.appendChild(li);
    });
    card.appendChild(elenco);
  }

  return card;
}

function mostraStage(dati) {
  const contenitore = document.getElementById("lista-stage");

  dati.forEach(r => {
    // Salto le righe completamente vuote
    const haContenuto = Object.values(r).some(valore => valore !== "");
    if (!haContenuto) return;

    // Un blocco per ogni stage: prima la card, poi la relazione
    const blocco = document.createElement("section");
    blocco.className = "stage";

    blocco.appendChild(creaCard(r));

    if (r.relazione) {
      aggiungiTesto(blocco, "h2", "", "Relazione");
      aggiungiTesto(blocco, "p", "relazione", r.relazione);
    }

    contenitore.appendChild(blocco);
  });
}

// ---------- AVVIO ----------

async function avvia() {
  try {
    const dati = await leggiFoglio(URL_STAGE);
    mostraStage(dati);
  } catch (errore) {
    mostraErrore("Non riesco a caricare i contenuti. Controlla che il foglio sia pubblicato.");
    console.error(errore);
  }
}

avvia();