// ID del Google Foglio pubblicato (lo stesso della Home, non cambia)
const ID_FOGLIO = "2PACX-1vRZfXT6ycb8Xov1QA7wpY6_Yuz1IhEHuH4Se9QnQdoOPAnWqOnnq6gY-USTRMIkoyP_11W0n7Uaiav4";

// Numero del tab "Extra": lo trovi nel link che dà Google dopo gid=
const GID_EXTRA = "194826978";

// Link CSV del tab "Extra"
const URL_EXTRA = "https://docs.google.com/spreadsheets/d/e/" + ID_FOGLIO + "/pub?gid=" + GID_EXTRA + "&single=true&output=csv";

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

// ---------- RENDERING DELLA PAGINA EXTRA ----------

// Crea un elemento con del testo e lo aggiunge, ma solo se il testo non è vuoto
function aggiungiTesto(contenitore, tag, classe, valore) {
  if (!valore) return;                     // cella vuota: non mostro niente
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  elemento.textContent = valore;
  contenitore.appendChild(elemento);
}

// Il link è valido solo se inizia con http:// o https://
function linkValido(link) {
  const minuscolo = link.toLowerCase();
  return minuscolo.startsWith("https://") || minuscolo.startsWith("http://");
}

// Crea una card per una riga "scheda"
function creaCard(r) {
  const card = document.createElement("div");
  card.className = "card";

  // Immagine: la creo solo se nella cella c'è il nome del file
  if (r.immagine) {
    const img = document.createElement("img");
    img.src = "img/" + r.immagine;
    img.alt = r.titolo;
    card.appendChild(img);
  }

  aggiungiTesto(card, "span", "etichetta", r.categoria);
  aggiungiTesto(card, "h3", "", r.titolo);
  aggiungiTesto(card, "p", "", r.descrizione);

  // Pulsante "Apri": solo se il link è valido, e si apre in una nuova scheda
  if (r.link && linkValido(r.link)) {
    const pulsante = document.createElement("a");
    pulsante.className = "pulsante";
    pulsante.href = r.link;
    pulsante.target = "_blank";
    pulsante.rel = "noopener noreferrer";
    pulsante.textContent = "Apri";
    card.appendChild(pulsante);
  }

  return card;
}

function mostraExtra(dati) {
  // Riga "pagina": titolo grande e introduzione
  const pagina = dati.find(r => r.sezione === "pagina");
  if (pagina) {
    const intestazione = document.getElementById("intestazione");
    aggiungiTesto(intestazione, "h1", "", pagina.titolo);
    aggiungiTesto(intestazione, "p", "introduzione", pagina.descrizione);
  }

  // Righe "scheda": una card per ogni riga
  const griglia = document.getElementById("griglia-schede");
  dati.filter(r => r.sezione === "scheda").forEach(r => {
    griglia.appendChild(creaCard(r));
  });
}

// ---------- AVVIO ----------

async function avvia() {
  try {
    const dati = await leggiFoglio(URL_EXTRA);
    mostraExtra(dati);
  } catch (errore) {
    mostraErrore("Non riesco a caricare i contenuti. Controlla che il foglio sia pubblicato.");
    console.error(errore);
  }
}

avvia();