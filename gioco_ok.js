// ID del Google Foglio pubblicato (lo stesso della Home, non cambia)
const ID_FOGLIO = "2PACX-1vRZfXT6ycb8Xov1QA7wpY6_Yuz1IhEHuH4Se9QnQdoOPAnWqOnnq6gY-USTRMIkoyP_11W0n7Uaiav4";

// Numero del tab "Gioco": lo trovi nel link che dà Google dopo gid=
const GID_GIOCO = "1193295955";

// Numero del tab "Livello": scrivi qui il suo numero
const GID_LIVELLO = "843779972";

// Link CSV del tab "Gioco"
const URL_GIOCO = "https://docs.google.com/spreadsheets/d/e/" + ID_FOGLIO + "/pub?gid=" + GID_GIOCO + "&single=true&output=csv&headers=1";

// Link CSV del tab "Livello"
const URL_LIVELLO = "https://docs.google.com/spreadsheets/d/e/" + ID_FOGLIO + "/pub?gid=" + GID_LIVELLO + "&single=true&output=csv&headers=1";

// ---------- COSTANTI ----------

const LATO = 32;            // lato di una casella in pixel
const GIOCATORE_L = 22;     // larghezza del giocatore
const GIOCATORE_A = 28;     // altezza del giocatore

const PASSO_TEMPO = 1000 / 60;   // il gioco si aggiorna 60 volte al secondo
const MAX_RITARDO = 100;         // se la pagina resta ferma, non recupero più di 100 ms
const VELOCITA_MAX_CADUTA = 16;  // il giocatore non cade più veloce di così

// Tasti usati nel gioco (event.key in minuscolo; la barra spaziatrice è " ")
const TASTI_SINISTRA = ["arrowleft", "a"];
const TASTI_DESTRA = ["arrowright", "d"];
const TASTI_SALTO = ["arrowup", " ", "w"];

// Valori di riserva, usati se nel foglio manca qualcosa
const RISERVA = {
  titolo: "Il mio gioco",
  istruzioni: "Frecce per muoverti, spazio per saltare. Raccogli le monete e arriva alla bandiera!",
  sfondo: "#87CEEB",
  giocatore: "#E63946",
  piattaforme: "#6B4F2A",
  monete: "#FFC300",
  ostacoli: "#555555",
  bandiera: "#2A9D8F"
};

// Quali tasti sono premuti in questo momento
const tasti = { sinistra: false, destra: false, salto: false };

// ---------- LETTURA DEL FOGLIO ----------

// Scarica un CSV con PapaParse e restituisce le righe.
// conIntestazioni = true: oggetti con i nomi delle colonne; false: liste di celle
function leggiFoglio(url, conIntestazioni) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: conIntestazioni,
      skipEmptyLines: conIntestazioni,   // nella griglia le righe vuote contano
      complete: risultato => resolve(risultato.data),
      error: errore => reject(errore)
    });
  });
}

// ---------- IMPOSTAZIONI ----------

// Trasforma le righe "impostazione / valore" in un solo oggetto
function leggiImpostazioni(righe) {
  const impostazioni = {};
  righe.forEach(riga => {
    const nome = String(riga.impostazione || "").trim().toLowerCase();
    const valore = String(riga.valore || "").trim();
    if (nome !== "") {
      impostazioni[nome] = valore;
    }
  });
  return impostazioni;
}

// Testo: se è vuoto o manca, usa la riserva
function prendiTesto(impostazioni, nome, riserva) {
  return impostazioni[nome] ? impostazioni[nome] : riserva;
}

// Colore: se non è un colore valido, usa la riserva
function prendiColore(impostazioni, nome, riserva) {
  const valore = impostazioni[nome];
  if (valore && CSS.supports("color", valore)) {
    return valore;
  }
  return riserva;
}

// Numero: se non è valido usa la riserva, poi lo tiene tra minimo e massimo
function prendiNumero(impostazioni, nome, riserva, minimo, massimo) {
  let numero = parseFloat(impostazioni[nome]);
  if (isNaN(numero)) {
    numero = riserva;
  }
  return Math.min(massimo, Math.max(minimo, numero));
}

// Mette insieme tutte le impostazioni già controllate
function creaConfigurazione(impostazioni) {
  return {
    titolo: prendiTesto(impostazioni, "titolo", RISERVA.titolo),
    istruzioni: prendiTesto(impostazioni, "istruzioni", RISERVA.istruzioni),
    sfondo: prendiColore(impostazioni, "sfondo", RISERVA.sfondo),
    giocatore: prendiColore(impostazioni, "giocatore", RISERVA.giocatore),
    piattaforme: prendiColore(impostazioni, "piattaforme", RISERVA.piattaforme),
    monete: prendiColore(impostazioni, "monete", RISERVA.monete),
    ostacoli: prendiColore(impostazioni, "ostacoli", RISERVA.ostacoli),
    bandiera: prendiColore(impostazioni, "bandiera", RISERVA.bandiera),
    velocita: prendiNumero(impostazioni, "velocita", 4, 2, 8),
    salto: prendiNumero(impostazioni, "salto", 12, 8, 16),
    gravita: prendiNumero(impostazioni, "gravita", 6, 3, 10),
    vite: Math.round(prendiNumero(impostazioni, "vite", 3, 1, 9)),
    personaggio: impostazioni.personaggio || ""   // facoltativo
  };
}

// ---------- LIVELLO ----------

// Trasforma la griglia del foglio in un livello pronto da disegnare
function creaLivello(righeFoglio) {
  // Tolgo le righe completamente vuote in fondo (restano solo quelle vere)
  const righe = righeFoglio.slice();
  while (righe.length > 0 && righe[righe.length - 1].every(c => String(c).trim() === "")) {
    righe.pop();
  }
  if (righe.length === 0) {
    throw new Error("Il tab Livello è vuoto");
  }

  // La larghezza è quella della riga più lunga
  const numRighe = righe.length;
  const numColonne = Math.max(...righe.map(r => r.length));

  const griglia = [];
  let partenza = null;

  for (let r = 0; r < numRighe; r++) {
    const rigaNuova = [];
    for (let c = 0; c < numColonne; c++) {
      // Maiuscole e minuscole valgono uguale, gli spazi si ignorano
      let simbolo = String(righe[r][c] || "").trim().toLowerCase();

      if (simbolo === "p") {
        if (partenza === null) {
          partenza = { riga: r, colonna: c };   // vale la prima P trovata
        }
        simbolo = " ";
      } else if (simbolo !== "#" && simbolo !== "o" && simbolo !== "^" && simbolo !== "f") {
        simbolo = " ";                          // tutto il resto è spazio vuoto
      }

      // Il bordo è sempre solido (la bandiera resta com'è)
      const èBordo = r === 0 || r === numRighe - 1 || c === 0 || c === numColonne - 1;
      if (èBordo && simbolo !== "f") {
        simbolo = "#";
      }

      rigaNuova.push(simbolo);
    }
    griglia.push(rigaNuova);
  }

  return { griglia: griglia, numRighe: numRighe, numColonne: numColonne, partenza: partenza };
}

// ---------- IMMAGINE DEL PERSONAGGIO ----------

// Prova a caricare l'immagine; se non si carica restituisce null
function caricaImmagine(nomeFile) {
  return new Promise(resolve => {
    if (nomeFile === "") {
      resolve(null);
      return;
    }
    const immagine = new Image();
    immagine.onload = () => resolve(immagine);
    immagine.onerror = () => resolve(null);
    immagine.src = "img/" + nomeFile;
  });
}

// ---------- GIOCATORE ----------

// Crea il giocatore sulla casella P, appoggiato sul fondo della casella
function creaGiocatore(livello) {
  if (livello.partenza === null) {
    return null;
  }
  return {
    x: livello.partenza.colonna * LATO + (LATO - GIOCATORE_L) / 2,
    y: (livello.partenza.riga + 1) * LATO - GIOCATORE_A,
    vy: 0,           // velocità verticale (negativa = sale, positiva = scende)
    aTerra: false    // vero se è appoggiato a una casella solida
  };
}

// ---------- COLLISIONI ----------

// Dice se una casella è solida. Fuori dal livello conta come solida
function casellaSolida(livello, riga, colonna) {
  if (riga < 0 || riga >= livello.numRighe || colonna < 0 || colonna >= livello.numColonne) {
    return true;
  }
  return livello.griglia[riga][colonna] === "#";
}

// Dice se un rettangolo del giocatore, messo in (x, y), tocca una casella solida
function toccaSolido(livello, x, y) {
  const margine = 0.0001;   // il bordo destro e basso appartengono alla casella precedente
  const colonnaSinistra = Math.floor(x / LATO);
  const colonnaDestra = Math.floor((x + GIOCATORE_L - margine) / LATO);
  const rigaSopra = Math.floor(y / LATO);
  const rigaSotto = Math.floor((y + GIOCATORE_A - margine) / LATO);

  for (let r = rigaSopra; r <= rigaSotto; r++) {
    for (let c = colonnaSinistra; c <= colonnaDestra; c++) {
      if (casellaSolida(livello, r, c)) {
        return true;
      }
    }
  }
  return false;
}

// ---------- MOVIMENTO ----------

// Muove il giocatore in orizzontale, a passi di al massimo 1 pixel
function muoviOrizzontale(giocatore, livello, spostamento) {
  const numPassi = Math.ceil(Math.abs(spostamento));
  if (numPassi === 0) {
    return;
  }
  const passo = spostamento / numPassi;

  for (let i = 0; i < numPassi; i++) {
    if (toccaSolido(livello, giocatore.x + passo, giocatore.y)) {
      break;                       // c'è un muro: mi fermo
    }
    giocatore.x += passo;
  }
}

// Salto, gravità e movimento verticale (a passi di al massimo 1 pixel)
function muoviVerticale(giocatore, livello, config) {
  // Si salta solo se si è appoggiati a terra
  if (tasti.salto && giocatore.aTerra) {
    giocatore.vy = -config.salto;
  }

  // La gravità aumenta la velocità verso il basso, fino al massimo
  giocatore.vy += config.gravita / 10;
  if (giocatore.vy > VELOCITA_MAX_CADUTA) {
    giocatore.vy = VELOCITA_MAX_CADUTA;
  }

  // Lo ricalcolo a ogni aggiornamento: è vero solo se tocco il suolo ora
  giocatore.aTerra = false;

  const numPassi = Math.ceil(Math.abs(giocatore.vy));
  if (numPassi === 0) {
    return;
  }
  const passo = giocatore.vy / numPassi;

  for (let i = 0; i < numPassi; i++) {
    if (toccaSolido(livello, giocatore.x, giocatore.y + passo)) {
      if (giocatore.vy > 0) {
        giocatore.aTerra = true;   // stavo scendendo: sono atterrato
      }
      giocatore.vy = 0;            // sia a terra sia con la testa sul soffitto
      break;
    }
    giocatore.y += passo;
  }
}

// Un aggiornamento del gioco (viene chiamato 60 volte al secondo)
function aggiorna(partita) {
  if (partita.giocatore === null) {
    return;
  }
  let direzione = 0;
  if (tasti.sinistra) {
    direzione -= 1;
  }
  if (tasti.destra) {
    direzione += 1;
  }
  muoviOrizzontale(partita.giocatore, partita.livello, direzione * partita.config.velocita);
  muoviVerticale(partita.giocatore, partita.livello, partita.config);
}

// ---------- TASTIERA ----------

// Aggiorna lo stato di un tasto; restituisce true se è un tasto del gioco
function registraTasto(evento, premuto) {
  const tasto = evento.key.toLowerCase();

  if (TASTI_SINISTRA.includes(tasto)) {
    tasti.sinistra = premuto;
  } else if (TASTI_DESTRA.includes(tasto)) {
    tasti.destra = premuto;
  } else if (TASTI_SALTO.includes(tasto)) {
    tasti.salto = premuto;
  } else {
    return false;
  }
  return true;
}

// Ascolta la tastiera
function attivaTastiera() {
  window.addEventListener("keydown", evento => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) {
      return;                                  // lascio stare le scorciatoie del browser
    }
    if (registraTasto(evento, true)) {
      evento.preventDefault();                 // niente scorrimento della pagina
    }
  });

  window.addEventListener("keyup", evento => {
    if (registraTasto(evento, false)) {
      evento.preventDefault();
    }
  });

  // Se la finestra perde il focus, nessun tasto resta "premuto"
  window.addEventListener("blur", () => {
    tasti.sinistra = false;
    tasti.destra = false;
    tasti.salto = false;
  });
}

// ---------- DISEGNO ----------

// Imposta la dimensione del canvas (una volta sola): dipende dalla griglia
function impostaCanvas(canvas, livello) {
  canvas.width = livello.numColonne * LATO;
  canvas.height = livello.numRighe * LATO;
}

// Piattaforma o muro: quadrato pieno
function disegnaPiattaforma(ctx, x, y, colore) {
  ctx.fillStyle = colore;
  ctx.fillRect(x, y, LATO, LATO);
}

// Moneta: cerchio al centro della casella
function disegnaMoneta(ctx, x, y, colore) {
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(x + LATO / 2, y + LATO / 2, 8, 0, Math.PI * 2);
  ctx.fill();
}

// Ostacolo: triangolo (spuntone) appoggiato sul fondo della casella
function disegnaOstacolo(ctx, x, y, colore) {
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + LATO);
  ctx.lineTo(x + LATO / 2, y + 4);
  ctx.lineTo(x + LATO - 2, y + LATO);
  ctx.closePath();
  ctx.fill();
}

// Bandiera: un'asta e un triangolo
function disegnaBandiera(ctx, x, y, colore) {
  ctx.fillStyle = colore;
  ctx.fillRect(x + 8, y + 2, 3, LATO - 2);          // asta
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 4);
  ctx.lineTo(x + 28, y + 11);
  ctx.lineTo(x + 11, y + 18);
  ctx.closePath();
  ctx.fill();
}

// Giocatore: rettangolo colorato oppure immagine, nella sua posizione attuale
function disegnaGiocatore(ctx, giocatore, config, immagine) {
  if (giocatore === null) {
    return;
  }
  const x = Math.round(giocatore.x);   // pixel interi: il disegno resta nitido
  const y = Math.round(giocatore.y);

  if (immagine !== null) {
    ctx.drawImage(immagine, x, y, GIOCATORE_L, GIOCATORE_A);
  } else {
    ctx.fillStyle = config.giocatore;
    ctx.fillRect(x, y, GIOCATORE_L, GIOCATORE_A);
  }
}

// Disegna tutta la scena: sfondo, livello e giocatore
function disegna(partita) {
  const ctx = partita.ctx;
  const livello = partita.livello;
  const config = partita.config;

  // Sfondo
  ctx.fillStyle = config.sfondo;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Una casella alla volta
  for (let r = 0; r < livello.numRighe; r++) {
    for (let c = 0; c < livello.numColonne; c++) {
      const simbolo = livello.griglia[r][c];
      const x = c * LATO;
      const y = r * LATO;

      if (simbolo === "#") {
        disegnaPiattaforma(ctx, x, y, config.piattaforme);
      } else if (simbolo === "o") {
        disegnaMoneta(ctx, x, y, config.monete);
      } else if (simbolo === "^") {
        disegnaOstacolo(ctx, x, y, config.ostacoli);
      } else if (simbolo === "f") {
        disegnaBandiera(ctx, x, y, config.bandiera);
      }
    }
  }

  disegnaGiocatore(ctx, partita.giocatore, config, partita.immagine);
}

// ---------- CICLO DEL GIOCO ----------

// Parte il ciclo: tempo fisso a 60 aggiornamenti al secondo (accumulatore)
function avviaCiclo(partita) {
  let ultimoTempo = null;
  let accumulatore = 0;

  function fotogramma(tempoAttuale) {
    if (ultimoTempo === null) {
      ultimoTempo = tempoAttuale;
    }
    // Tempo passato dall'ultimo fotogramma (con un limite massimo)
    accumulatore += Math.min(tempoAttuale - ultimoTempo, MAX_RITARDO);
    ultimoTempo = tempoAttuale;

    // Faccio tanti aggiornamenti fissi quanti ne servono per recuperare il tempo
    while (accumulatore >= PASSO_TEMPO) {
      aggiorna(partita);
      accumulatore -= PASSO_TEMPO;
    }

    disegna(partita);
    requestAnimationFrame(fotogramma);
  }

  requestAnimationFrame(fotogramma);
}

// ---------- MESSAGGI ----------

// Mostra un messaggio d'errore al posto della pagina vuota
function mostraErrore(messaggio) {
  const box = document.getElementById("messaggio-errore");
  box.textContent = messaggio;
  box.hidden = false;
}

// Scrive un messaggio nel paragrafo "stato"
function mostraStato(messaggio) {
  document.getElementById("stato").textContent = messaggio;
}

// ---------- AVVIO ----------

async function avvia() {
  try {
    // 1. Leggo i due tab
    const righeGioco = await leggiFoglio(URL_GIOCO, true);
    const righeLivello = await leggiFoglio(URL_LIVELLO, false);

    // 2. Preparo impostazioni e livello
    const config = creaConfigurazione(leggiImpostazioni(righeGioco));
    const livello = creaLivello(righeLivello);

    // 3. Titolo e istruzioni nella pagina
    document.getElementById("titolo").textContent = config.titolo;
    document.getElementById("istruzioni").textContent = config.istruzioni;

    // 4. Immagine del personaggio (se c'è) e canvas
    const immagine = await caricaImmagine(config.personaggio);
    const canvas = document.getElementById("gioco");
    impostaCanvas(canvas, livello);

    // 5. Tutto quello che serve al gioco sta in un solo oggetto
    const partita = {
      ctx: canvas.getContext("2d"),
      livello: livello,
      config: config,
      immagine: immagine,
      giocatore: creaGiocatore(livello)
    };

    // 6. Messaggio per il giocatore
    if (partita.giocatore === null) {
      mostraStato("Nel livello manca la casella P (partenza del giocatore).");
    } else {
      mostraStato("Muoviti con le frecce (o A/D) e salta con freccia su, spazio o W.");
    }

    // 7. Tastiera e ciclo del gioco
    attivaTastiera();
    avviaCiclo(partita);
  } catch (errore) {
    mostraErrore("Non riesco a caricare il gioco. Controlla che il foglio sia pubblicato e che i gid dei tab siano giusti.");
    console.error(errore);
  }
}

avvia();