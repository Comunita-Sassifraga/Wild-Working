# SPEC — Prenotazione postazioni coworking Valle Soana

**Progetto:** Wild Working — Comunità Sassifraga APS
**Versione:** 0.1 (bozza da validare)
**Data:** settembre 2026
**Stato:** in definizione — vedi §11 "Decisioni ancora aperte"

---

## 1. Obiettivo

Strumento digitale che permette a chiunque di verificare la disponibilità di postazioni di lavoro negli spazi di coworking della Valle Soana, prenotarne una per una fascia oraria, e — se lo desidera — rendere visibile agli altri la propria presenza.

Lo strumento è realizzato e messo a disposizione da Comunità Sassifraga APS. Gli spazi sono di gestione comunale (Ingria, Ronco Canavese, Valprato Soana), nell'ambito del progetto "Coworking in valle".

**Il valore distintivo non è la prenotazione in sé, ma la visibilità sociale.** Sistemi di prenotazione ne esistono a decine; nessuno permette di scegliere *dove* lavorare in base a *chi* ci sarà. Ogni decisione di prodotto in caso di dubbio va risolta a favore di questa funzione.

### Obiettivi secondari

- Produrre automaticamente i dati di utilizzo (accessi, occupazione, stagionalità) necessari alla rendicontazione verso APICE / Fondazione Compagnia di San Paolo e ai KPI del piano strategico.
- Restituire ai Comuni una fotografia **aggregata** dell'effettivo utilizzo degli spazi, a supporto di future scelte di investimento (D10).

### Non obiettivi

- Non è un gestionale di coworking commerciale: niente pagamenti, abbonamenti, fatturazione.
- Non è un social network: niente messaggistica interna, niente commenti, niente profili.
- Non gestisce il tesseramento all'APS né il libro soci.

---

## 2. Decisioni assunte

| #   | Decisione                                 | Scelta                                                                                                                                                                                                                                       |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Chi può prenotare                         | Chiunque, con la sola email. Nessun requisito di tesseramento.                                                                                                                                                                               |
| D2  | Gestione degli spazi                      | I Comuni gestiscono gli spazi; l'APS fornisce lo strumento.                                                                                                                                                                                  |
| D3  | Conferma della prenotazione               | Immediata e automatica. Nessuna approvazione umana.                                                                                                                                                                                          |
| D4  | Unità prenotabile                         | Il *posto*, non la scrivania specifica. L'utente vede "3 posti liberi su 5".                                                                                                                                                                 |
| D5  | Fasce orarie                              | Fisse: mattina, pomeriggio, giornata intera. Nessun orario libero.                                                                                                                                                                           |
| D6  | Nome pubblico                             | Facoltativo, con consenso separato e revocabile.                                                                                                                                                                                             |
| D7  | Numero di prenotazioni attive per persona | Nessun limite. La finestra di prenotazione (D8) rende strutturalmente impossibile superare 30 prenotazioni attive. Il parametro resta configurabile (§10) in caso di necessità.                                                              |
| D8  | Finestra di prenotazione                  | Si può prenotare da oggi fino a **oggi + 14 giorni inclusi**. Finestra mobile: ogni giorno si apre un nuovo giorno e si chiude quello trascorso.                                                                                             |
| D9  | Stagionalità delle sedi                   | Una sede può essere disponibile solo in certi periodi dell'anno. I periodi sono dati modificabili dall'amministratore, non regole scritte nel codice. Fuori dai propri periodi una sede non è prenotabile e scompare dalla vista principale. |
| D10 | Titolare del trattamento                  | Solo Comunità Sassifraga APS. Contatto privacy: Letizia Melano. **Il software non trasmette mai dati personali ai Comuni.** I Comuni ricevono statistiche aggregate. Se un Comune ha bisogno di sapere chi si trova nel proprio immobile (sicurezza, assicurazione), lo gestisce con un registro presenze cartaceo in loco, che è un trattamento suo, separato e indipendente da questo strumento. |
| D11 | Indirizzo del servizio                    | Sottodominio **`wildworking.sassifraga.org`**. Non una sottocartella di `www.sassifraga.org`: il sito è su Google Sites, che non permette di dirottare un percorso verso un'applicazione esterna. Vedi §14.                                    |
| D12 | Mittente delle email                      | Le email dell'app partono da un **sottodominio dedicato** (`noreply@wildworking.sassifraga.org`), mai dal dominio principale. Protegge la consegna della posta istituzionale. Vedi §14.                                                        |
| D13 | Dati facoltativi                          | Cinque campi facoltativi (età, genere, professione, motivo della visita, residenza), raccolti su consenso separato e revocabile. Richiedibili anche in registrazione, ma mai bloccanti. Usati solo in forma aggregata (§6.8).               |
| D14 | Moderazione del nome pubblico             | Moderazione **successiva**: il nome è pubblico subito, l'amministratore viene avvisato e può azzerarlo. Filtro automatico in scrittura come prima difesa.                                                                                   |
| D15 | Divisione fra le due pagine pubbliche     | La griglia di disponibilità mostra **conteggi**: posti liberi su totale e numero di presenze pubbliche. I **nomi pubblici** compaiono soltanto nella pagina "Chi c'è in Valle". Ogni pagina rimanda all'altra con un collegamento e una nota. Vedi §6.2 e §6.6.                        |
| D17 | Secondo servizio nella stessa applicazione | **«Prenota un abitante»** — attività proposte dagli abitanti della valle ai residenti VIHTA — vive dentro Wild Working, non in una piattaforma separata. Il modulo è **additivo**: cinque tabelle nuove più una di servizio, nessuna tabella esistente modificata — ma sette parti già in esercizio vengono comunque toccate, elencate in §15.1. Vedi §15. |
| D18 | Accesso al modulo                         | **Codice personale monouso** per ogni residente, che una volta usato genera un'abilitazione legata all'account. Non un codice unico condiviso. Il codice si inserisce **dopo** l'accesso normale, una volta sola, la prima volta che si apre il modulo: **il flusso di autenticazione non si tocca in nessun punto**. Vedi §15.4. |
| D19 | Ingresso al modulo                        | Un solo ingresso dentro l'applicazione: **in cima alla pagina della disponibilità**, a chi ha fatto l'accesso e mentre un'edizione è attiva, un **pulsante «Prenota un abitante»** che porta a `/abitanti`. Solo il pulsante, senza nessuna nota che lo accompagni: chi è di VIHTA sa cos'è, e a chi non lo è la spiegazione non serve. Nessuna voce di navigazione, nessun rimando dalla pagina «Chi c'è in Valle». Il cartoncino consegnato all'arrivo porta il codice e un QR verso `/abitanti`, ma non è più il solo modo di arrivarci. Vedi §15.5. |
| D20 | Chi carica le attività                    | L'amministratore, a mano, dal pannello. Gli abitanti non hanno un account: propongono per telefono, email o di persona. |
| D21 | Consenso degli abitanti proponenti        | L'informativa si raccoglie **firmata a mano**, di persona: molti abitanti sono anziani e non si registrerebbero mai su un'app. Nel software l'amministratore mette una **spunta** con cui dichiara di averla raccolta e conservata; il sistema annota quando e chi. Senza spunta l'attività non è pubblicabile. Il valore legale sta nella carta, la spunta è la dichiarazione tracciata che la carta esiste. Vedi §15.8. |
| D23 | Visibilità dei dati degli abitanti        | Tre livelli. **1**, a tutti gli abilitati: nome di battesimo, titolo, comune o frazione, descrizione scritta dall'abitante. **2**, solo a chi si iscrive: cognome, telefono, indirizzo esatto. **3**, solo all'amministratore: note interne. Vedi §15.8. |
| D22 | Lista d'attesa per le attività            | **No.** Era stata proposta, ed è stata scartata il 12/09 per tenere il modulo costruibile nei tempi dell'edizione 2026. A posti esauriti l'attività dice "completa" e non si può fare altro dall'app. Chi disdice lo annuncia fra i partecipanti, che si coordinano fuori dall'applicazione; l'amministratore annulla l'iscrizione di chi rinuncia e iscrive chi subentra, dal pannello (§15.7, §15.9). Vedi anche §15.15. |
| D16 | Nome del servizio                         | **Wild Working**. Per esteso, dove serve dire chi lo fa: *Wild Working — Comunità Sassifraga*. Il nome vive nel titolo della pagina, sotto l'icona sul telefono, nel titolo della schermata di disponibilità e nelle email di accesso; non compare nell'intestazione, che resta logo più "Comunità Sassifraga" (§13.8). Non tocca il verbo *prenotare*: il pulsante che prenota continua a dire "Prenota", e i nomi di dati e tabelle restano quelli del glossario (§3). Un nome inglese non dice da solo di cosa si tratta, quindi dove compare per la prima volta — le email, la descrizione dell'app — lo accompagna sempre la frase che lo spiega: *"il servizio di prenotazione degli spazi di coworking della Valle Soana"*. Decisione dell'11/09, che sostituisce il precedente "Prenota". |
| D25 | Dove gira l'applicazione                  | **Cloudflare Workers**, non Vercel. Il DPA di Vercel copre soltanto i piani Pro ed Enterprise e l'account dell'associazione è sul piano gratuito: senza contratto di nomina a responsabile del trattamento non si può pubblicare (art. 28 GDPR). Il DPA di Cloudflare copre anche gli account gratuiti self-serve. Una condizione per non profit era stata chiesta a Vercel il 13/09/2026 e non è arrivata. Conseguenza diretta: i due giri notturni non possono più essere programmati dall'ospite — su Cloudflare un Cron Trigger chiama un Worker, non un indirizzo qualsiasi — e partono da **tre azioni programmate di GitHub**, che è già il repository del progetto e non riceve nessun dato personale. Vedi §10 e §14.5. |
| D24 | Minorenni                                 | **Il servizio è aperto anche ai minorenni.** Non si chiede l'età, non si verifica, non si aggiunge nessuna barriera d'ingresso. Registrazione e prenotazione si fondano sull'art. 6.1.b e non hanno soglie d'età. I **due consensi facoltativi** (nome pubblico e dati facoltativi) si fondano invece sull'art. 6.1.a, e per i servizi online il consenso di chi ha meno di **14 anni** vale solo se lo presta chi esercita la responsabilità genitoriale (art. 8 GDPR, art. 2‑quinquies del Codice Privacy). La soglia si dichiara nell'informativa e **non si costruisce nel software**: un controllo dell'età richiederebbe la data di nascita, cioè esattamente il dato che la regola 1 vieta. Aggiunge la fascia `Meno di 18` a §5.1. Fuori da questa decisione resta «Prenota un abitante», i cui partecipanti sono maggiorenni (§15.4). Decisione del 12/09/2026. |

---

## 3. Glossario

Da usare in modo coerente in tutto il progetto — nel codice, nell'interfaccia e nelle conversazioni con Claude Code.

| Termine                  | Significato                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sede**                 | Uno degli spazi di coworking.                                                                                                                                              |
| **Capienza**             | Numero di posti prenotabili in una sede, per fascia. Modificabile dall'amministratore.                                                                                     |
| **Fascia**               | Blocco orario prenotabile: `MATTINA`, `POMERIGGIO`.                                                                                                                        |
| **Giornata intera**      | Non è una fascia: è una scorciatoia dell'interfaccia che crea due prenotazioni (mattina + pomeriggio) collegate tra loro.                                                  |
| **Prenotazione**         | Il diritto di un utente a occupare un posto in una sede, in una data, in una fascia.                                                                                       |
| **Nome pubblico**        | Etichetta facoltativa mostrata agli altri utenti. Può essere un nome, un soprannome, un'iniziale.                                                                          |
| **Referente di sede**    | Persona incaricata dal Comune o dall'APS di sorvegliare una sede. Vede le prenotazioni della propria sede.                                                                 |
| **Amministratore**       | Chi gestisce sedi, capienze, chiusure e utenti. Al lancio: il Consiglio Direttivo dell'APS.                                                                                |
| **Periodo di attività**  | Intervallo di date in cui una sede è disponibile. Serve alle sedi stagionali. Una sede senza periodi dichiarati è disponibile tutto l'anno.                                |
| **Chiusura**             | Eccezione puntuale **dentro** un periodo di attività: un giorno o una fascia in cui la sede, pur essendo in stagione, non è prenotabile (festività, manutenzione, evento). |
| **Finestra prenotabile** | L'arco di giorni su cui si può agire: da oggi a oggi + `FINESTRA_GIORNI`. Mobile: scorre in avanti di un giorno al giorno.                                                 |
| **VIHTA**                | La residenza temporanea in Valle Soana. I suoi partecipanti sono le uniche persone che accedono a «Prenota un abitante»: è per loro che esistono i codici d'invito e le abilitazioni. Fuori da questo modulo, un partecipante VIHTA è un utente come tutti gli altri. |
| **Edizione**             | Il periodo in cui il modulo «Prenota un abitante» è attivo. Es. VIHTA 2026. Interruttore temporale del modulo (§15.3.1).                                                   |
| **Attività**             | Evento unico proposto da un abitante della valle, in un giorno e a un'ora precisi, con una capienza propria. Non è una prenotazione: non si ripete (§15.3.2).              |
| **Abitante**             | Chi propone un'attività. **Non è un utente della piattaforma**: non ha account e i suoi dati li inserisce l'amministratore, con il consenso di §15.8.                      |
| **Iscrizione**           | Il diritto di un residente a partecipare a un'attività. Sta alle attività come la prenotazione sta alle postazioni (§15.3.3).                                              |
| **Abilitazione**         | Il permesso di un utente di accedere al modulo per una certa edizione. È la vera autorizzazione; il codice serve solo a crearla (§15.3.4).                                 |
| **Codice d'invito**      | Biglietto monouso consegnato al residente all'arrivo. Si consuma al primo uso. Nel sistema ne esiste solo l'impronta, mai il codice (§15.3.5).                             |

---

## 4. Ruoli

| Ruolo                           | Può fare                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visitatore** (non registrato) | Vedere la disponibilità della finestra prenotabile (oggi + `FINESTRA_GIORNI`). Vedere la pagina pubblica "Chi c'è". Leggere l'informativa privacy.                                        |
| **Utente registrato**           | Tutto quanto sopra, più: prenotare, annullare le proprie prenotazioni, impostare il nome pubblico, modificare il proprio profilo, scaricare i propri dati, cancellare il proprio account. |
| **Referente di sede**           | Tutto quanto sopra, più: vedere l'elenco nominativo delle prenotazioni **della sola sede assegnata**, limitato alla **finestra prenotabile**. Non inserisce chiusure: le segnala al Direttivo, che le inserisce dal pannello (§6.7). |
| **Partecipante VIHTA**          | Un utente registrato con un'**abilitazione attiva** (§15.3.4). Tutto quanto sopra, più: vedere le attività dell'edizione, iscriversi, annullare la propria iscrizione. Non è un ruolo separato dagli altri: è un utente registrato con un permesso in più, che scade con l'edizione. |
| **Amministratore**              | Tutto. Gestire sedi, capienze, chiusure, referenti. Moderare i nomi pubblici (§6.5). Vedere le statistiche aggregate (§6.8), che non contengono né email né nomi pubblici. Cancellare un account su richiesta. Gestire edizioni, attività, codici, abilitazioni e iscritti del modulo «Prenota un abitante», comprese l'iscrizione e l'annullamento per conto di un partecipante (§15.9). |

**Regola di minimizzazione:** nessun ruolo, incluso l'amministratore, ha accesso a dati nominativi dopo che sono trascorsi 30 giorni dalla prenotazione o dall'attività. Restano solo dati aggregati e anonimi. Questo evita che lo strumento diventi un archivio degli spostamenti delle persone.

---

## 5. Struttura dei dati

Nove entità per il coworking, descritte qui. Il modulo «Prenota un abitante» ne aggiunge cinque più una tabella di servizio, in §15.3: nessuna delle nove cambia.

- Un **utente** ha un'email e, se vuole, un nome pubblico.
- Una **sede** ha un nome, un indirizzo, una capienza e degli orari.
- Una **prenotazione** collega un utente a una sede, in una data, in una fascia.
- Una **chiusura** rende una sede non prenotabile in un certo periodo.
- Un **consenso** registra quando e per cosa un utente ha dato o revocato il permesso.
- Un **incarico** assegna il ruolo di referente a un utente per una sede.
- Un **periodo attività** indica in quali periodi dell'anno la sede è attiva.
- Un **termine vietato** è una voce dell'elenco che il filtro dei nomi pubblici confronta in scrittura.
- Una **moderazione** registra l'azzeramento di un nome pubblico da parte di un amministratore.
- Un **posto offerto** annota quanti posti una sede offriva in un certo giorno e fascia.

### 5.1 utenti

| Campo                  | Tipo                                                    | Obbligatorio | Note                                               |
| ---------------------- | ------------------------------------------------------- | ------------ | -------------------------------------------------- |
| `id`                   | identificativo interno                                  | sì           | Generato dal sistema                               |
| `email`                | testo                                                   | **sì**       | Unico dato personale obbligatorio                  |
| `nome_pubblico`        | testo, max 40 caratteri                                 | no           | Vuoto = non compare mai in pagine pubbliche        |
| `eta`                  | `Meno di 18`, `18-25`, `26-35`, `36-50`, `51-65`, `Oltre 65` | no      | La prima fascia nasce con D24. È un intervallo, mai una data di nascita |
| `genere`               | `M` / `F` / `Preferisco non rispondere`                 | no           |                                                    |
| `professione`          | testo, max 100 caratteri                                | no           |                                                    |
| `motivo_visita`        | testo, max 200 caratteri                                | no           |                                                    |
| `residenza`            | `Valle Soana`/`Canavese`/ `Piemonte` / `Italia`/`Altro` | no           |                                                    |
| `mostra_nome_pubblico` | sì/no                                                   | sì           | Default: **no**                                    |
| `lingua`               | `it` / `en` / `fr`                                      | sì           | Default `it`                                       |
| `creato_il`            | data e ora                                              | sì           |                                                    |
| `ultimo_accesso`       | data e ora                                              | sì           | Serve per la cancellazione degli account dormienti |

Non esiste un campo password: l'accesso avviene via link inviato per email (§6.1).

La fascia `Meno di 18` è una **modifica di un elenco di valori già esistente**,
non un campo nuovo: la regola 1 di `CLAUDE.md` resta intatta. Richiede però una
migrazione sull'elenco `fascia_eta`, che è un tipo del database e non un elenco
scritto nel codice. **Alla data di D24 la migrazione non è ancora stata fatta**:
finché non lo è, chi ha meno di 18 anni non ha una risposta onesta da dare e
lascia il campo vuoto. L'informativa privacy è già scritta con la fascia dentro,
quindi la migrazione va fatta **prima** di pubblicarla.

### 5.2 sedi

| Campo                | Tipo           | Note                                                                                                                                      |
| -------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | identificativo |                                                                                                                                           |
| `nome`               | testo          | Es. "Coworking Ronco Canavese"                                                                                                            |
| `comune`             | testo          | Ingria / Ronco Canavese / Valprato Soana                                                                                                  |
| `indirizzo`          | testo          |                                                                                                                                           |
| `coordinate`         | lat/lon        | Per il link a mappe e indicazioni stradali                                                                                                |
| `capienza`           | numero         | **DA CONFERMARE** — vedi §11                                                                                                              |
| `ora_inizio_mattina` | orario         | Default `09:00`. Da qui in poi la prenotazione della mattina non si annulla più (§6.4)                                                     |
| `ora_fine_mattina`   | orario         | Default `13:00`                                                                                                                           |
| `ora_inizio_pomeriggio` | orario      | Default `14:00`. Da qui in poi la prenotazione del pomeriggio non si annulla più (§6.4)                                                    |
| `ora_fine_pomeriggio` | orario        | Default `18:00`                                                                                                                           |
| `giorni_apertura`    | elenco         | Default lun–sab. Modificabile per sede dal pannello. Concorre alla prenotabilità (condizione 5 sotto)                                     |
| `note`               | testo libero   | Wi‑Fi, chiavi, accesso, dotazioni. Visibile solo agli utenti registrati, mai nelle pagine pubbliche. Non contiene mai password o codici    |
| `attiva`             | sì/no          | Interruttore generale. Se spento, la sede scompare ovunque, a prescindere dai periodi. Serve per sospensioni immediate o non pianificate. |
| `sempre_disponibile` | sì/no          | Se sì, la sede ignora i periodi di attività ed è disponibile tutto l'anno. Default: sì.                                                   |

L'orario che le persone leggono (`09:00–13:00`) è composto da questi quattro
valori: sono orari veri e non testo libero, perché l'ora di inizio della fascia
è il limite oltre il quale non si annulla più (§6.4) e la banca dati deve poterla
confrontare con l'ora corrente.

Una sede è prenotabile in una certa data se, e solo se, **tutte** queste condizioni sono vere:

1. `attiva` è sì;
2. `sempre_disponibile` è sì **oppure** la data ricade dentro almeno un periodo di attività (§5.7);
3. la combinazione data + fascia non ricade in una chiusura (§5.4); una chiusura senza fascia vale per tutte le fasce del giorno;
4. la data è dentro la finestra prenotabile (§6.3);
5. il giorno della settimana è fra i `giorni_apertura` della sede.

### 5.3 prenotazioni

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `utente_id` | riferimento a utente | |
| `sede_id` | riferimento a sede | |
| `data` | data | |
| `fascia` | `MATTINA` / `POMERIGGIO` | |
| `posto_progressivo` | numero da 1 a capienza | Assegnato dal sistema, **mai mostrato all'utente**. Vedi §8.1 |
| `gruppo_id` | identificativo | Collega le due prenotazioni di una giornata intera |
| `stato` | `ATTIVA` / `ANNULLATA` | |
| `creata_il` | data e ora | |
| `anonimizzata` | sì/no | Diventa sì quando il **giorno prenotato** è più vecchio di 30 giorni — non il giorno in cui la prenotazione è stata fatta: è la data della presenza, ed è ciò di cui la riga parla. Il legame con l'utente viene reciso |
| `stat_eta` | fascia d'età, come §5.1 | Vuoto fino all'anonimizzazione. Vedi sotto |
| `stat_genere` | come §5.1 | Idem |
| `stat_professione` | testo, max 100 caratteri | Idem |
| `stat_motivo_visita` | testo, max 200 caratteri | Idem |
| `stat_residenza` | come §5.1 | Idem |

#### I cinque campi `stat_`: perché esistono

I dati facoltativi (§5.1) stanno sulla tabella degli utenti, non su quella delle prenotazioni. Recidendo il legame fra prenotazione e utente dopo 30 giorni, senza altri accorgimenti si perderebbe per sempre la possibilità di sapere che quella prenotazione fu di una persona di una certa fascia d'età o residenza — e le statistiche di §6.8 sarebbero calcolabili solo sull'ultimo mese, cioè inutili per la rendicontazione annuale.

Per questo, **nel momento in cui una prenotazione viene anonimizzata**, i cinque valori facoltativi dell'utente vengono copiati nei campi `stat_` della prenotazione stessa.

Regole della copia:

- Avviene **una sola volta**, contestualmente all'anonimizzazione. Prima di allora i campi `stat_` sono vuoti: il dato vive in un posto solo.
- Avviene **solo se il consenso `DATI_FACOLTATIVI` è attivo in quel momento**. Se l'utente non ha compilato i campi, o li ha revocati, i campi `stat_` restano vuoti e quella prenotazione non contribuisce alle statistiche demografiche.
- **Non avviene** quando l'utente esercita il diritto di cancellazione (art. 17): in quel caso le prenotazioni passate vengono anonimizzate senza copiare nulla. Una richiesta esplicita di cancellazione va onorata per intero, non aggirata con una copia.
- Dopo la copia il dato **non è più un dato personale**: non esiste alcun modo, nel sistema, di risalire dalla prenotazione anonimizzata alla persona. Per questo i campi `stat_` non hanno una scadenza.
- I campi `stat_` sono **leggibili solo dal motore delle statistiche** (§6.8). Non compaiono in nessuna pagina, in nessuna vista di amministrazione per singola prenotazione, in nessuna esportazione che non sia aggregata.

### 5.4 chiusure

`id`, `sede_id`, `data_inizio`, `data_fine`, `fascia` (o "tutte"), `creata_da`.

### 5.5 consensi

`id`, `utente_id`, `tipo`, `valore` (dato/revocato), `data_ora`.

Tipi di consenso previsti:

| Tipo | Copre | Come si dà | Come si revoca |
|---|---|---|---|
| `NOME_PUBBLICO` | Visibilità del nome pubblico nelle pagine consultabili da chiunque | Accendendo l'interruttore in §6.5 | Spegnendo l'interruttore |
| `DATI_FACOLTATIVI` | Età, genere, professione, motivo della visita, residenza — raccolti per le statistiche aggregate (§6.8) | Salvando almeno uno dei cinque campi, in registrazione o nel profilo | Pulsante "Rimuovi i miei dati facoltativi" nel profilo, che svuota tutti e cinque i campi |

I due consensi sono **indipendenti**: si può dare l'uno senza l'altro, e revocare l'uno senza toccare l'altro. Nessuno dei due è condizione per usare il servizio.

Questa tabella è **append-only**: non si modifica e non si cancella nulla, si aggiunge una riga a ogni cambiamento. Serve a dimostrare, se richiesto, quando un consenso è stato dato o ritirato (art. 7.1 GDPR).

Il consenso `DATI_FACOLTATIVI` si considera revocato quando tutti e cinque i campi sono vuoti, qualunque sia la strada con cui sono stati svuotati (pulsante "Rimuovi" o modifica manuale): il registro segue lo stato reale dei dati, e le righe le scrive il database da solo a ogni cambiamento. Per la stessa ragione una riga di revoca del `NOME_PUBBLICO` può nascere anche da un azzeramento dell'amministratore (§6.5): il registro segue lo stato reale della visibilità, non soltanto le scelte della persona. Il registro sopravvive alla cancellazione dell'account (§7): le righe conservano l'identificativo interno dell'utente, che dopo la cancellazione non rimanda più a nessuno. La cancellazione stessa (art. 17) scrive una riga di revoca per ogni consenso ancora attivo in quel momento, per la stessa ragione di sempre: il registro segue lo stato reale del trattamento, e con l'account il trattamento finisce (decisione del 11/09).

Perché la conservazione di 24 mesi (§7) sia applicabile, la chiusura di un account — richiesta dalla persona o decisa dalla pulizia notturna — annota internamente **la data della chiusura**, insieme al solo identificativo interno. Senza quella data non ci sarebbe modo di sapere da quando contare: le righe del registro portano un identificativo che non rimanda più a nessuno, e una chiusura che non revoca nulla non scrive nessuna riga. L'annotazione non contiene nessun dato personale, non è leggibile da nessuno se non dalle pulizie automatiche, e sparisce insieme alle righe di consenso a cui si riferisce (decisione del 11/09).

### 5.6 incarichi

`id`, `utente_id`, `sede_id`, `ruolo` (`REFERENTE` / `AMMINISTRATORE`), `attivo`.

`sede_id` è obbligatorio per `REFERENTE` e vuoto per `AMMINISTRATORE`: l'amministratore è globale e vale su tutte le sedi (§4).

### 5.7 periodi_attivita

Serve alle sedi disponibili solo in certe parti dell'anno.

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `sede_id` | riferimento a sede | |
| `data_inizio` | data | |
| `data_fine` | data | Inclusa |
| `etichetta` | testo | Mostrata all'utente. Es. "Stagione estiva 2026" |
| `ricorre_ogni_anno` | sì/no | Se sì, si considerano solo giorno e mese: il periodo si ripete ogni anno senza doverlo reinserire |

Regole:

- Una sede può avere **più periodi** (es. giugno–settembre e dicembre–marzo).
- I periodi possono essere sovrapposti senza che questo causi errori: vale l'unione, non l'intersezione.
- Nessun periodo dichiarato **e** `sempre_disponibile` a no significa che la sede non è mai prenotabile. L'interfaccia deve avvisare l'amministratore di questa situazione, che quasi sempre è un errore.
- Aggiungere, spostare o accorciare un periodo **non cancella mai** prenotazioni già esistenti in automatico: vale la stessa regola di §8.2.

### 5.8 termini_vietati

`id`, `termine`, `creato_il`, `creato_da`.

L'elenco usato dal filtro automatico di §6.5. Modificabile dal pannello, senza toccare il codice. Lo legge soltanto l'amministratore: conoscere l'elenco è sapere come aggirarlo.

### 5.9 moderazioni

`id`, `utente_id`, `nome_rimosso`, `amministratore_id`, `avvenuta_il`.

Una riga per ogni azzeramento di §6.5 livello 3: chi, quando, quale nome è stato rimosso. Non contiene mai l'email. Si conserva finché esiste l'account della persona: cancellato l'account, sparisce con lui.

### 5.10 posti_offerti

`data`, `sede_id`, `fascia`, `posti`.

Quanti posti una sede ha offerto in un certo giorno e in una certa fascia. Una riga per giorno, sede e fascia, scritta dal giro notturno la notte successiva e mai più modificata. È il denominatore del tasso di occupazione di §6.8.

Esiste perché quel denominatore non ha memoria. Quanti posti c'erano da prendere il 12 marzo dipende dalla capienza, dai giorni di apertura, dai periodi di attività e dalle chiusure di quel giorno (§5.2) — quattro cose che l'amministratore modifica dal pannello senza lasciare traccia. Alzare una capienza oggi riscriverebbe in silenzio tutti i mesi passati, accorciare una stagione farebbe sparire giorni che erano aperti. Il numero va quindi annotato mentre è ancora vero, come già succede per i conteggi delle persone (§6.8) e per i campi `stat_` (§5.3).

Regole della scrittura:

- Avviene **una volta sola per giorno**, la notte dopo. Quello che è annotato non cambia più: una chiusura inserita in seguito non riscrive il passato.
- Un giorno in cui la sede era chiusa — sospesa, fuori stagione, giorno non di apertura, o chiusura anche solo su quella fascia — vale **zero**. Zero e "nessuna riga" sono due cose diverse: zero vuol dire chiusa, nessuna riga vuol dire che il giro non è girato.
- Si annota **da quando la funzione entra in servizio, mai all'indietro**. Il tasso di occupazione è quindi esatto dalla messa in esercizio in avanti, e per i giorni precedenti non è calcolabile in alcun modo.
- Se il giro resta fermo qualche notte, alla ripartenza recupera i giorni mancanti con le impostazioni di quel momento. È l'unica approssimazione ammessa.
- Nessuna riga corrisponde a una persona: un giorno, una sede, una fascia e un numero. La legge il solo motore delle statistiche (§6.8).

---

## 6. Funzionamento

### 6.1 Registrazione e accesso

1. L'utente inserisce la propria email.
2. **Prima** del pulsante di invio, vede il link all'informativa privacy e la frase: *"Registrandoti accetti che la tua email sia usata per gestire le prenotazioni. È l'unico dato obbligatorio che dovrai fornire: se vorrai compilare gli altri, ci serviranno a migliorare il servizio di coworking."*
3. Riceve un'email con un link valido **15 minuti**, utilizzabile **una sola volta**.
4. Cliccando, entra. Se è la prima volta, il profilo viene creato in quel momento. Un'email che ha richiesto un link senza mai usarlo non ha un profilo e viene eliminata dalla pulizia notturna (§7).
5. **Solo al primo accesso**, subito dopo la creazione dell'account, compare una schermata con il **nome pubblico** e i cinque campi facoltativi (§6.5), introdotta da: *"Se vuoi, raccontaci qualcosa di te. Ci serve solo per capire chi usa gli spazi e migliorarli. Puoi saltare, compilarne solo alcuni, o cambiarli quando vuoi."* Il nome pubblico compare qui, e non soltanto nelle impostazioni, perché è la funzione che dà valore all'app (§1): un campo che si trova solo dentro una pagina di impostazioni non lo compila quasi nessuno, e senza nomi la pagina «Chi c'è in Valle» resta vuota. Vale anche per lui, per intero, la regola qui sotto: non è obbligatorio e non blocca niente.
6. La sessione dura **30 giorni dall'ultimo utilizzo**, poi va richiesto un nuovo link.

Regole generali sul flusso:
- Non esiste un passaggio separato "registrati" / "accedi": è lo stesso flusso.
- Il messaggio mostrato dopo l'invio è sempre identico (*"Se l'indirizzo è valido, riceverai un'email"*), sia che l'email esista sia che non esista. Questo evita di rivelare a un estraneo chi è iscritto.
- Massimo 5 richieste di link per email all'ora, e 20 per indirizzo di rete (parametri di §10). Il conteggio si basa su impronte irreversibili, non sugli indirizzi: nessuna email e nessun indirizzo di rete viene conservato per questo scopo (§7).

Regole sulla schermata del primo accesso (passo 5):
- Nessun campo è obbligatorio e **nessun campo blocca il proseguimento**: se si lasciano tutti vuoti — nome pubblico compreso — la registrazione è completa lo stesso e si arriva alla prenotazione.
- Il pulsante per proseguire senza compilare è **visibile quanto** quello per salvare, e la sua etichetta è chiara: *"Salta"*. Non è un collegamento piccolo in fondo alla pagina.
- La schermata compare **una sola volta**. Chi salta non la rivede: i campi restano disponibili nel profilo.
- Non compare mai prima dell'ingresso, né come passaggio della richiesta del link. Chiedere questi dati come condizione per accedere renderebbe il consenso non liberamente prestato (art. 7.4 GDPR).

### 6.2 Vedere la disponibilità

Vista predefinita: **un calendario dell'intera finestra prenotabile — oggi e i `FINESTRA_GIORNI` successivi — e, per il giorno scelto, le sedi attive affiancate.**

Il calendario copre settimane intere: dal lunedì della settimana in corso alla domenica della settimana in cui cade l'ultimo giorno prenotabile. Con `FINESTRA_GIORNI` a 14 sono tre righe, da lunedì a domenica. I giorni su cui non si può agire restano visibili ma spenti e non selezionabili: quelli già passati, quelli oltre la finestra, e quelli in cui nessuna sede è aperta. Le settimane restano intere perché un calendario che comincia a metà settimana si legge male.

Ogni giorno porta una parola, e non il solo colore: **"Libero"** quando resta libera almeno una fascia in almeno una sede, **"Esaurito"** quando le sedi aperte sono tutte piene, **"Chiuso"** quando nessuna sede è aperta. Nessun conteggio: il calendario dice *se* si può prenotare quel giorno, non *quanto*. Quanti posti restino, e dove, si legge sotto, per il giorno scelto. I giorni spenti perché passati o non ancora dentro la finestra portano solo il numero, senza spiegazione: il calendario stesso mostra già dove si trova oggi. All'apertura è selezionato oggi. Ogni giorno prenotabile ha un proprio indirizzo web, condivisibile. Un indirizzo che chiede un giorno inesistente, passato, chiuso o oltre la finestra riporta alla vista predefinita — e **perde la data che aveva chiesto**: una barra degli indirizzi che continuasse a dire un giorno diverso da quello mostrato racconterebbe il falso, e un collegamento condiviso da lì se lo porterebbe dietro.

Sotto il calendario, per il giorno scelto, le sedi sulle righe e le due fasce sulle colonne.

Le sedi fuori dal proprio periodo di attività **non compaiono nella griglia**, ma sono elencate sotto, in una sezione separata e discreta: *"Sedi non disponibili in questo periodo"*, con l'etichetta del prossimo periodo e la data di riapertura, se nota. Farle sparire del tutto porterebbe le persone a credere che abbiano chiuso definitivamente.

Per ogni combinazione sede / giorno / fascia si mostra:
- posti liberi su totale (es. "4 / 6");
- il **numero** di persone che hanno reso pubblica la presenza — **non i loro nomi**.

I nomi pubblici stanno soltanto nella pagina "Chi c'è in Valle" (§6.6, D15). La griglia è una tabella di conteggi: con tre sedi, quindici giorni e due fasce sono novanta celle, e farci stare fino a sei nomi ciascuna la renderebbe illeggibile su un telefono. Le due pagine si dividono il lavoro: qui *quanti*, lì *chi*.

**Collegamento alla pagina pubblica.** Subito sotto l'introduzione della pagina e **sopra la griglia**, un collegamento a "Chi c'è in Valle" accompagnato dalla nota: *"Guarda chi c'è in valle nei prossimi giorni"*.

Sta sopra la griglia, non in fondo, per due ragioni. Da telefono la griglia è lunga e un collegamento in coda non lo vedrebbe nessuno. Ed è lì che nasce la domanda: si legge "2 persone hanno reso pubblica la presenza" e si vuole sapere chi sono.

È un **pulsante di azione principale** (§13.6): riempimento `verde`, testo `testo`, angoli 4px, con la nota sotto in `testo-secondario`. Decisione del 10/09/2026, che sostituisce la scelta precedente di un collegamento sottolineato: «Chi c'è in Valle» è la funzione che dà valore all'app (§1), e chi arriva sulla disponibilità deve vederla senza doverla cercare. Il costo è dichiarato: il pulsante pesa più del "Prenota" delle celle, che resta un collegamento dentro la griglia.

Resta vietata la **fascia** in Stile 2 sopra la griglia. Un pulsante è un elemento circoscritto; una fascia a tutta larghezza è un registro (§13.2), e sopra la griglia la schiaccerebbe.

Il collegamento speculare di §6.6 **non** diventa un pulsante: l'asimmetria è voluta, e la ragione sta lì.

Accessibile **senza registrazione**. La registrazione serve solo per prenotare.

**Ingresso a «Prenota un abitante».** In cima alla pagina, sopra il pulsante di "Chi c'è in Valle", compare l'ingresso al secondo servizio (§15.5). Si mostra **solo a chi ha fatto l'accesso** e **solo mentre un'edizione è attiva** (§15.3.1): un visitatore non registrato non lo vede, e il 18 ottobre sparisce da sé.

È un **pulsante in Stile 1** con scritto *"Prenota un abitante"*, che porta a `/abitanti`. Nient'altro: nessuna nota sopra, nessuna spiegazione sotto, e la stessa cosa per tutti — sia per chi è già abilitato, sia per chi deve ancora inserire il codice.

Il pulsante è in Stile 1 — non riempito di `verde` — proprio per non competere con quello di "Chi c'è in Valle", che è l'azione principale della pagina per tutti, mentre questo riguarda 45 persone su un'edizione sola.

Questa è la sola modifica che il modulo porta a una pagina già esistente del coworking, e il solo ingresso al modulo dentro l'applicazione. Sostituisce, dal 12/09/2026, la riga discreta in fondo alla griglia che era stata proposta in una prima stesura di §15.5: quella riga, in coda a una pagina lunga da telefono, non l'avrebbe vista nessuno, e il modulo si sarebbe retto tutto sul cartoncino di carta.

### 6.3 Prenotare

1. L'utente sceglie sede, giorno e fascia (o "giornata intera").
   Se sceglie la giornata intera e una delle due fasce è esaurita, non viene
   creata nessuna prenotazione: il sistema dice quale fascia è piena e propone
   di prenotare solo l'altra. Una richiesta di giornata intera non si
   accontenta di mezza giornata senza che la persona lo abbia scelto.
2. Il sistema verifica in tempo reale che ci sia ancora posto.
3. La prenotazione è confermata **immediatamente**, senza approvazioni. La conferma si legge a schermo e resta consultabile in **"Le mie prenotazioni"**: al momento della prenotazione non parte nessuna email (decisione del 10/09).
4. **La sera prima parte un promemoria** con: sede, comune, indirizzo, data, orario di ogni fascia prenotata, le informazioni pratiche della sede, e il collegamento a "Le mie prenotazioni" per annullare. Il messaggio contiene un invito esplicito ad annullare a chi già sa che non verrà: il posto torna libero per qualcun altro.

**Perché un promemoria e non una conferma.** Una conferma dice quello che la persona ha appena visto a schermo e può rileggere in ogni momento nella propria pagina. Un promemoria arriva invece nel momento in cui la persona può ancora cambiare idea, ed è l'unico momento in cui l'email fa qualcosa che l'app da sola non fa. Ne parte una sola per persona e per giorno: chi ha preso la giornata intera, o due sedi lo stesso giorno, legge un messaggio con tutto dentro.

**Regole del promemoria:**
- Parte **una volta al giorno**, all'ora `ORA_PROMEMORIA` (§10), per le prenotazioni attive del giorno successivo.
- Chi prenota **dopo** che il giro di quel giorno è passato non riceve nulla: ha appena visto la conferma a schermo, e il giro successivo guarda già oltre (§8.4).
- Una prenotazione annullata non riceve nessun promemoria.
- Una prenotazione riceve il promemoria **una volta sola**. Il segno di "già inviato" è scritto dalla banca dati nello stesso gesto con cui le righe vengono prese in carico, come il vincolo di §8.1: due esecuzioni sovrapposte non possono mandare due messaggi. La conseguenza, accettata, è che un invio fallito è un promemoria perso, mai un promemoria doppio.
- Una `chiusura` inserita dopo la prenotazione **non** ferma il promemoria: la prenotazione resta valida finché una persona non interviene (§8.2, e non si annulla mai d'ufficio la prenotazione di qualcun altro).

Vincoli:
- Non si può prenotare nel passato.
- Non si può prenotare oltre **oggi + `FINESTRA_GIORNI` inclusi** (14 al lancio). Esempio con 14: sabato 15 agosto si può prenotare fino a sabato 29 agosto compreso; domenica 30 agosto è il primo giorno non prenotabile.
- Il calcolo di "oggi" avviene sempre nel fuso orario **Europe/Rome**, mai in orario universale (§8.4).
- Non si può avere più di una prenotazione attiva nella stessa data e fascia (nemmeno in sedi diverse). Il vincolo è imposto dal database, come quello di §8.1.
- Non si può prenotare una sede chiusa o disattivata.

### 6.4 Annullare

- Sempre possibile, fino all'orario di inizio della fascia.
- Un clic da **"Le mie prenotazioni"** — la pagina che elenca le proprie prenotazioni attive da oggi fino alla fine della finestra, con sede, giorno, fascia e orario. Nessuna conferma richiesta oltre al clic. Le prenotazioni passate non compaiono: dopo 30 giorni vengono comunque anonimizzate (§7).
- Il promemoria di §6.3 **porta a quella pagina**, non annulla da solo. Un collegamento che annullasse con un clic dall'email avrebbe bisogno di un gettone segreto nell'indirizzo, cioè di un'altra cosa da proteggere e da tenere fuori da ogni registro (§8.3). Siccome la sessione dura 30 giorni, quasi sempre il collegamento apre la pagina già collegati; chi è scaduto rifà l'accesso normale. Nell'email il collegamento si legge *"Vai a Le mie prenotazioni per annullare"*, che è esattamente quello che fa.
- Annullando una giornata intera si annullano entrambe le fasce, salvo scelta esplicita di annullarne una sola.
- Se il posto liberato era l'ultimo disponibile e qualcuno è in attesa: **fuori dall'MVP**, vedi §9.

### 6.5 Nome pubblico e dati facoltativi

#### Nome pubblico

Si sceglie in due posti: nella schermata del primo accesso (§6.1 punto 5) e, per sempre dopo, nelle impostazioni personali. In entrambi il blocco è lo stesso e si legge dall'alto in basso in quest'ordine:

- L'intestazione *"Nome pubblico"*.
- La spiegazione: *"Questo è il nome che verrà visualizzato nella pagina «Chi c'è in Valle» accanto ai giorni che hai prenotato, se selezionerai la spunta «Mostra il nome pubblico». Se la spegni, il nome sparisce subito da tutte le prenotazioni, anche da quelle già fatte."*
- Il campo di testo in cui si scrive il nome.
- L'interruttore, etichettato *"Mostra il nome pubblico"* — **spento di default**.

Il campo viene **prima** dell'interruttore perché è la spiegazione a dire cosa fa l'interruttore: chiedere di accendere qualcosa prima di aver visto cosa accende è chiedere una decisione al buio.

- Nelle impostazioni, sotto il blocco, un'anteprima esatta di come il nome apparirà agli altri. Nella schermata del primo accesso non c'è: non c'è ancora niente di salvato da mostrare.
- Spegnendo l'interruttore, il nome sparisce **immediatamente e retroattivamente** da tutte le prenotazioni, passate e future.
- L'interruttore si può accendere prima di aver scelto un nome, ma da solo non fa niente: senza un nome non c'è niente da mostrare, quindi la presenza non compare fra i nomi di «Chi c'è in Valle» e non entra nel conteggio di *chi ha reso pubblica la presenza* di §6.2. **Il posto prenotato resta occupato per tutti**: chi non mostra il nome pesa sui posti liberi su totale esattamente come chiunque altro, e rientra fra le «persone che preferiscono non condividere pubblicamente il nome» di §6.6. Le impostazioni lo dicono: *"Hai acceso la spunta ma non hai ancora scelto un nome: finché non lo scegli comparirai senza nome, come chi ha preferito non condividerlo."*

**Le impostazioni personali sono un elenco solo**, non tre sezioni: email, nome pubblico, dati facoltativi, lingua. Ogni voce ha la stessa intestazione, e quello che si può cambiare si cambia dove si legge. Email e lingua sono in sola lettura. Chi apre questa pagina fa una domanda sola, *"cosa sapete di me"*, e deve trovare una risposta sola.

Sotto l'elenco, e **fuori** da esso, i due diritti di §7 che la persona esercita da sola: *"Scarica i miei dati"* e *"Cancella il mio account"*. Non sono voci dell'elenco e non stanno sotto il *"Salva"*: l'elenco risponde a *"cosa sapete di me"*, questi due dicono *"cosa posso farne"*. Il primo è un collegamento che scarica un file e basta. Il secondo porta a una pagina di conferma a sé stante — non a un secondo pulsante accanto al primo: la cancellazione è l'unica cosa in tutta l'app che non si può disfare, e la conferma dev'essere un posto in cui si arriva, dove le conseguenze sono scritte per esteso e l'unico altro comando riporta indietro.

**Un solo pulsante *"Salva"*** in fondo, che salva insieme il nome pubblico e i cinque campi facoltativi — come già fa la schermata del primo accesso. Accanto, *"Rimuovi i miei dati facoltativi"*, che non è una variante del salvataggio ma l'azione a sé di §6.5: svuota i cinque campi e lascia stare il nome.

Il nome può essere rifiutato, i cinque campi no. Per questo **i campi si salvano per primi**: chi sbaglia il nome non perde quello che aveva appena compilato, e legge una frase sola che dice tutte e due le cose — *"Nel nome non puoi mettere link, indirizzi email o numeri di telefono. Scegli un nome più semplice. Il resto lo abbiamo salvato: manca solo il nome."* Un salvataggio "o tutto o niente" sarebbe più facile da raccontare, ma farebbe ribattere cinque campi per un errore in un sesto.

Ripremere *"Salva"* senza aver cambiato niente non costa nulla: il limite giornaliero conta solo un nome davvero diverso, e il registro dei consensi scrive una riga solo quando i cinque campi passano da vuoti a compilati o viceversa (§5.5).

Regole tecniche:
- Se `mostra_nome_pubblico` è spento, il nome non deve mai uscire dal database verso una pagina pubblica. Il filtro va imposto a livello di banca dati, non di interfaccia (§8.3).
- Massimo 40 caratteri. Il salvataggio è rifiutato se il nome contiene una chiocciola (indirizzo email), un link (`://`, `www.`, o un punto attaccato fra lettere come in `sassifraga.org`), o un numero di telefono (sei o più cifre di fila, anche separate da spazi, punti, trattini o parentesi, oppure un `+` seguito da una cifra). Validazione automatica in scrittura. A differenza dei termini vietati, queste regole si spiegano volentieri: il messaggio dice cosa togliere — *"Nel nome non puoi mettere link, indirizzi email o numeri di telefono. Scegli un nome più semplice."*

#### Moderazione del nome pubblico

La moderazione è **successiva, non preventiva** (D14): il nome diventa pubblico subito e viene corretto dopo, se serve. È la scelta sostenibile per un'associazione di volontari, che non può presidiare una coda di approvazione a ogni ora del giorno. La conseguenza va accettata consapevolmente: **un nome offensivo può restare visibile per alcune ore**, finché un amministratore non interviene.

Il meccanismo ha tre livelli.

**1. Filtro automatico in scrittura.** Prima di salvare, il nome viene confrontato con un elenco di termini vietati, modificabile dall'amministratore senza toccare il codice. Se corrisponde, il salvataggio è rifiutato con un messaggio neutro: *"Questo nome non può essere usato. Prova con un altro."* Nessuna spiegazione su quale parola abbia fatto scattare il filtro: servirebbe solo a insegnare come aggirarlo. Il filtro si somma ai divieti già previsti sopra (link, email, numeri di telefono).

Il confronto ignora maiuscole e accenti e cerca il termine **in qualsiasi punto** del nome: «Idiota», «idiota77» e «SEIUNIDIOTA» vengono rifiutati tutti e tre. La conseguenza va accettata: un nome legittimo che contenga per caso la sequenza di un termine vietato viene rifiutato anche lui, e il messaggio neutro non spiega perché. È il prezzo di un filtro che non si aggira attaccando una lettera. Chi si trova bloccato e non capisce scrive all'associazione.

**2. Avviso all'amministratore.** Ogni volta che un nome pubblico viene impostato per la prima volta o modificato, parte una email a `EMAIL_MODERAZIONE` (§10) contenente **soltanto**:
- il nome pubblico inserito;
- l'identificativo interno dell'utente (`utente_id`);
- un collegamento diretto all'azione di moderazione nel pannello.

L'email **non contiene l'indirizzo email dell'utente**, né alcun altro suo dato. L'identificativo interno basta all'amministratore per agire e non rivela chi sia la persona.

Per evitare che modifiche ripetute inondino la casella — e consumino il tetto giornaliero di invii del fornitore di posta, che è condiviso con le conferme di prenotazione — vale un limite: **massimo `MAX_CAMBI_NOME_GIORNO` modifiche al giorno per utente** (§10). Oltre il limite il nome non si può cambiare fino al giorno successivo, con messaggio esplicito.

Conta come modifica **soltanto un salvataggio che cambia il testo del nome** — cioè esattamente ciò che fa partire un'email. Risalvare lo stesso nome non consuma niente, e nemmeno accendere o spegnere l'interruttore della visibilità: non manda nessun avviso, e nessuno deve restare visibile controvoglia fino al giorno dopo. Il giorno è quello di calendario, nel fuso Europe/Rome, quindi il nome torna disponibile a mezzanotte.

**3. Azzeramento da parte dell'amministratore.** L'azione è nel pannello (§6.7). Azzerare significa: svuotare `nome_pubblico` e spegnere `mostra_nome_pubblico`.

L'utente **deve essere informato**. Riceve una email: *"Il nome che avevi scelto per la pagina «Chi c'è in Valle» è stato rimosso perché non rispetta le regole di utilizzo. Le tue prenotazioni non sono state toccate: continuano a valere, semplicemente non compare più un nome accanto. Puoi sceglierne un altro dalle tue impostazioni."* Lo stesso messaggio compare nelle impostazioni personali al primo accesso successivo.

Senza questo avviso l'utente continuerebbe a credere che il proprio nome sia visibile e non capirebbe perché nessuno lo vede: è la situazione che genera le segnalazioni di malfunzionamento più difficili da diagnosticare.

L'azzeramento **non cancella le prenotazioni** e non chiude l'account. Non esiste, nell'MVP, alcuna sanzione oltre alla rimozione del nome.

#### Dati facoltativi

Cinque campi (§5.1): età, genere, professione, motivo della visita, residenza. Raccolti sotto il consenso `DATI_FACOLTATIVI` (§5.5).

- Si possono compilare in registrazione (§6.1, passo 5) o in qualsiasi momento dal profilo.
- Si possono compilare **in parte**: nessun campo dipende da un altro.
- Sono modificabili in qualsiasi momento.
- Un pulsante *"Rimuovi i miei dati facoltativi"* svuota tutti e cinque i campi e registra la revoca del consenso. È immediato e non richiede l'intervento di nessuno.

**Regola vincolante: nessuno di questi cinque campi compare mai in una pagina pubblica, né è mai visibile ad altri utenti o ai referenti di sede.** L'unico dato dell'utente che può diventare pubblico è il nome pubblico. Questi campi esistono soltanto per produrre le statistiche aggregate di §6.8, e all'amministratore arrivano solo in quella forma.

### 6.6 Pagina pubblica "Chi c'è in Valle"

Una pagina consultabile senza registrazione, condivisibile su Instagram e via messaggio.

Mostra, per ciascuna sede disponibile: **l'intera finestra prenotabile — oggi e i `FINESTRA_GIORNI` successivi**, con i nomi pubblici di chi ha dato il consenso e il numero (senza nome) di chi non l'ha dato. La finestra è la stessa di §6.2, derivata dallo stesso parametro: non è un valore indipendente.

I due gruppi stanno in una riga sola, non in due elenchi separati: prima i nomi, poi chi manca. Per esteso: *"Mario Rossi, Chiara Bianchi + 2 persone che preferiscono non condividere pubblicamente il nome"*. Al singolare: *"… + 1 persona che preferisce non condividere pubblicamente il nome"*. Se nessuno ha reso pubblico il nome resta la sola coda, senza il `+`: *"3 persone che preferiscono non condividere pubblicamente il nome"*. Il numero è la differenza fra i prenotati e i nomi mostrati: non identifica nessuno, e dice quanto è pieno lo spazio, che è ciò che serve a chi sta decidendo dove andare. Chi tiene il nome nascosto non sparisce: occupa un posto e si vede che lo occupa.

**Le due fasce, separate.** Dentro ogni giorno la mattina e il pomeriggio hanno una riga ciascuna, con il proprio orario: si prenota una fascia, non un giorno, e chi arriva nel pomeriggio deve poter sapere chi troverà. Chi ha prenotato la giornata intera compare in tutte e due. Una fascia in cui non c'è nessuno non porta nessuna riga.

**Solo i giorni in cui c'è qualcuno.** La finestra resta quella di §6.2 — oggi e i `FINESTRA_GIORNI` successivi — ma di quella finestra si elencano soltanto i giorni con almeno un prenotato: con tre sedi, quindici giorni e due fasce sarebbero novanta blocchi quasi tutti vuoti, illeggibili proprio da telefono, che è da dove questa pagina viene guardata. Una sede senza nessun prenotato resta nell'elenco con la sola riga *"Da oggi ai prossimi `FINESTRA_GIORNI` giorni non c'è ancora nessuno"*: farla sparire direbbe che ha chiuso.

**Non mostra mai il passato.** Un archivio pubblico di dove una persona è stata nei mesi scorsi è un dato molto più invasivo di "domani sarò a Ronco", anche se composto dagli stessi elementi.

**È l'unico posto in cui compaiono i nomi pubblici.** La griglia di §6.2 si ferma ai conteggi. Chi in futuro volesse aggiungere i nomi anche alla griglia sta cancellando la ragione per cui questa pagina esiste.

**Collegamento alla disponibilità.** Nella stessa posizione speculare — sotto l'introduzione, sopra l'elenco delle sedi — un collegamento alla pagina della disponibilità con la nota: *"Guarda quanti posti restano e prenota il tuo"*. Chi arriva qui da un collegamento condiviso non ha visto nient'altro dell'app: senza questo rimando vede chi c'è e non sa come aggiungersi.

Il collegamento sta **fuori** dalla fascia verde, sullo sfondo crema, quindi è in `verde-testo` come tutti gli altri. Dentro un blocco Stile 2 sarebbe in `testo` (§13.6). Resta un collegamento sottolineato anche ora che quello di §6.2 è un pulsante: qui sta a ridosso della fascia verde del titolo, e una seconda superficie verde attaccata a quella si leggerebbe come un blocco solo.

### 6.7 Pannello di amministrazione

- Gestione sedi: aggiunta/cancellazione sede, nome, indirizzo, capienza, orari, giorni di apertura, note, attiva/sospesa, sempre disponibile sì/no.
- **Gestione periodi di attività**: aggiungere, modificare, eliminare i periodi di una sede stagionale; marcarli come ricorrenti ogni anno. Deve bastare un minuto per far comparire o scomparire una sede dalla vista, senza chiedere aiuto a nessuno.
- Gestione chiusure: intervallo di date, fascia.
- Gestione incarichi: assegnare e revocare il ruolo di referente.
- **Moderazione dei nomi pubblici** (§6.5): dall'identificativo utente ricevuto per email, azzerare il nome pubblico con un'azione. L'azione richiede una conferma, invia in automatico l'avviso all'utente e viene registrata (chi, quando, quale nome è stato rimosso). La schermata mostra il nome pubblico e l'identificativo interno, **mai l'email dell'utente**.
- **Gestione dell'elenco dei termini vietati** usato dal filtro automatico: aggiungere e rimuovere voci senza toccare il codice.
- **Prenotazioni da controllare**: l'elenco delle prenotazioni che un cambiamento ha lasciato fuori — capienza abbassata sotto il numero di prenotati, chiusura inserita su un giorno già prenotato, periodo accorciato, sede sospesa, giorno della settimana tolto dalle aperture (§8.2, §8.4). Il pannello mostra sede, giorno, fascia, motivo e l'indirizzo a cui scrivere. Non annulla mai niente da solo: decide una persona. Lo stesso elenco accoglie le **iscrizioni** rimaste fuori da un cambiamento di capienza di un'attività (§15.12).
- **Attività, codici e abilitazioni** del modulo «Prenota un abitante»: la sezione è descritta in §15.9. Compare nel pannello solo quando esiste un'edizione.
- Statistiche aggregate (§6.8).
- **Cancellazione di un account** su richiesta scritta dell'interessato: la persona si cerca dal suo indirizzo email, che è quello con cui la richiesta arriva. La schermata mostra l'identificativo interno e quante prenotazioni verrebbero annullate, e l'azione chiede una conferma. Fa esattamente la stessa cosa del pulsante che la persona ha nelle proprie impostazioni (§7), non una cosa simile. Rifiuta però la cancellazione di chi ha un incarico di amministratore attivo, con un messaggio esplicito: un clic sbagliato non deve poter lasciare l'associazione senza pannello, e un amministratore che voglia andarsene ha sempre il pulsante nelle proprie impostazioni.

Le ultime due voci non appartengono al passo che costruisce il pannello: le statistiche si costruiscono al passo 12 di §12. Anche la cancellazione dal pannello resta per ora spenta: al passo 10 si costruiscono i due diritti che la persona esercita da sola (§7), che sono quelli che la legge impone di rendere immediati; la schermata del pannello serve solo per le richieste che arrivano per iscritto, e si aggiunge più avanti (decisione del 11/09). Il pannello le nomina fin da subito, spente, perché si veda che esistono e non sembrino dimenticate.

### 6.8 Statistiche

Solo **aggregate e anonime**. Nessun dato riferibile a una persona.

- Prenotazioni per mese, per sede.
- Tasso di occupazione medio, per sede e per fascia: prenotazioni attive diviso posti offerti, **sui soli giorni in cui la sede era aperta**. Un giorno di chiusura non pesa né sopra né sotto: la misura dice quanto sono usati gli spazi quando ci sono, non quanto spesso siano chiusi (decisione dell'11/09).
  I posti offerti si leggono da `posti_offerti` (§5.10), annotati notte per notte perché il denominatore, a differenza delle prenotazioni, non sopravvive a una modifica della capienza o del calendario. Per questo il tasso è calcolabile **solo dai giorni successivi alla messa in esercizio** di quell'annotazione: per i giorni precedenti non esiste e non si ricostruisce.
- Persone distinte che hanno usato gli spazi in un mese (conteggio, senza elenco), sia in totale sia per sede — due numeri distinti, perché chi in un mese usa due sedi conta in entrambe ma una volta sola nel totale: la somma delle sedi non è il totale.
  Questo conteggio non si può ricavare dallo storico, perché dopo l'anonimizzazione non si sa più se dieci prenotazioni di marzo fossero di dieci persone o di una venuta dieci volte. Viene quindi calcolato **nel momento stesso in cui il legame viene reciso** e conservato come semplice conteggio per mese e per sede. Come per i dati demografici qui sotto, il motore unisce due fonti: lo storico da quei conteggi, gli ultimi 30 giorni dalle prenotazioni ancora collegate. Conta come "aver usato" una prenotazione attiva e non annullata: finché non esiste il check-in di §9 il sistema non sa chi si sia davvero presentato.
- Tasso di mancata presentazione, se e quando esisterà il check-in (§9).
- **Distribuzione dei dati facoltativi**: età, genere, professione, motivo della visita, residenza. Sempre come conteggi per categoria, mai come elenco di persone.
  Su tutto lo storico le statistiche demografiche si calcolano dai campi `stat_` delle prenotazioni anonimizzate (§5.3); sugli ultimi 30 giorni, dai dati dell'utente. Il motore deve unire le due fonti senza contare due volte la stessa prenotazione.
- Esportazione in CSV per la rendicontazione ad APICE e agli enti finanziatori.

#### Regole vincolanti delle statistiche

L'amministratore ha accesso ai dati facoltativi **ai soli fini statistici** e senza poterli ricondurre a una persona. Perché questo sia vero nei fatti e non solo nelle intenzioni, valgono due regole tecniche.

1. **Nessuna email e nessun nome pubblico compaiono mai** in una vista statistica o in un'esportazione. Non come colonna, non come filtro, non come dettaglio a scomparsa. Nemmeno l'identificativo interno dell'utente.
2. **Nessuna riga corrisponde a una persona.** Le viste espongono soltanto conteggi per categoria. Non esiste da nessuna parte, nel pannello, un elenco di utenti con accanto i loro dati facoltativi.

Nessun conteggio viene soppresso o arrotondato: tutti i dati facoltativi raccolti entrano nelle statistiche, comprese le categorie con pochi elementi. Il servizio è usato anche da persone che non risiedono in valle, quindi le categorie non coincidono con la popolazione locale.

Le stesse due regole valgono per il CSV esportato, che è la via più facile per aggirarle senza accorgersene.

---

## 7. Dati personali: cosa, perché, per quanto

| Dato                  | Obbligatorio | Perché lo trattiamo                                                                 | Base giuridica                                          | Chi lo vede                                                                             | Per quanto                                    |
| --------------------- | ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| Email                 | **Sì**       | Identificare chi ha prenotato, mandare il promemoria della sera prima, permettere l'annullamento | Art. 6.1.b — necessario a erogare il servizio richiesto | L'utente, il referente della sede prenotata (solo prossimi 14 giorni), l'amministratore | Finché l'account esiste                       |
| Nome pubblico         | No           | Permettere agli altri di scegliere la sede in base a chi ci sarà                    | Art. 6.1.a — **consenso**, revocabile                   | Chiunque, anche non registrati                                                          | Finché il consenso è attivo                   |
| Eta                   | No           | Per raccogliere dati facoltativi, utili a capire l'utilità del servizio di coworkin | Art. 6.1.a — **consenso**, revocabile                   | L'utente. L'amministratore solo in forma aggregata (§6.8), mai collegato all'identità   | Finché il consenso è attivo                   |
| Genere                | No           | Per raccogliere dati facoltativi, utili a capire l'utilità del servizio di coworkin | Art. 6.1.a — **consenso**, revocabile                   | L'utente. L'amministratore solo in forma aggregata (§6.8), mai collegato all'identità   | Finché il consenso è attivo                   |
| Professione           | No           | Per raccogliere dati facoltativi, utili a capire l'utilità del servizio di coworkin | Art. 6.1.a — **consenso**, revocabile                   | L'utente. L'amministratore solo in forma aggregata (§6.8), mai collegato all'identità   | Finché il consenso è attivo                   |
| Motivo visita         | No           | Per raccogliere dati facoltativi, utili a capire l'utilità del servizio di coworkin | Art. 6.1.a — **consenso**, revocabile                   | L'utente. L'amministratore solo in forma aggregata (§6.8), mai collegato all'identità   | Finché il consenso è attivo                   |
| Residenza             | No           | Per raccogliere dati facoltativi, utili a capire l'utilità del servizio di coworkin | Art. 6.1.a — **consenso**, revocabile                   | L'utente. L'amministratore solo in forma aggregata (§6.8), mai collegato all'identità   | Finché il consenso è attivo                   |
| Lingua                | No           | Mostrare l'interfaccia nella lingua giusta                                          | Art. 6.1.b                                              | Solo il sistema                                                                         | Finché l'account esiste                       |
| Prenotazioni          | Sì           | Erogare il servizio                                                                 | Art. 6.1.b                                              | Come l'email                                                                            | 30 giorni in forma riferibile, poi anonimizzate (§5.3) |
| Registro dei consensi | Sì           | Dimostrare quando un consenso è stato dato o revocato                               | Art. 6.1.c — obbligo di legge (art. 7.1 GDPR)           | L'utente, per le proprie righe (anche in "Scarica i miei dati"). L'amministratore, tutte | 24 mesi dopo la chiusura dell'account         |
| Data ultimo accesso   | Sì           | Cancellare gli account dormienti                                                    | Art. 6.1.f — legittimo interesse alla minimizzazione    | Solo il sistema                                                                         | Finché l'account esiste                       |

Il modulo «Prenota un abitante» aggiunge nove righe a questa tabella e quattro pulizie: stanno in §15.11, insieme al trattamento dei dati degli abitanti che propongono le attività — che sono persone non registrate, e il cui consenso si raccoglie fuori dall'app (§15.8). Fra quelle righe ce n'è una che riguarda i **partecipanti** e non gli abitanti, e va ripresa anche nell'informativa che leggono loro: il nome pubblico di chi si iscrive viene comunicato a chi ospita.

### Minori (D24)

Il servizio è **aperto anche ai minorenni**, e questo non aggiunge niente al
software: nessuna barriera d'ingresso, nessuna dichiarazione d'età da spuntare,
nessun campo nuovo. La ragione è la stessa regola 1 di `CLAUDE.md`: verificare
l'età vorrebbe dire chiedere la data di nascita, cioè raccogliere per tutti un
dato personale in più per proteggere una minoranza — il contrario della
minimizzazione.

Le due basi giuridiche si comportano in modo diverso, ed è la distinzione che
regge tutto il capitolo:

- **Registrarsi, prenotare, annullare** stanno sull'art. 6.1.b. Non c'è nessuna
  soglia d'età: il servizio è stato chiesto, e i dati in gioco sono un indirizzo
  email e una prenotazione.
- **I due consensi facoltativi** stanno sull'art. 6.1.a. Per i servizi della
  società dell'informazione il consenso di chi ha meno di **14 anni** è valido
  solo se prestato da chi esercita la responsabilità genitoriale (art. 8 GDPR;
  la soglia italiana è fissata dall'art. 2‑quinquies del Codice Privacy, che
  l'ha abbassata dai 16 del Regolamento).

La soglia dei 14 anni vive quindi **nell'informativa, non nel codice**. È una
scelta consapevole e va detta per intero: significa che il sistema non può
impedire a un dodicenne di accendere il nome pubblico. Quello che può fare, e
che fa, è che l'interruttore nasce spento (§6.5), che l'informativa spiega la
regola e consiglia un soprannome al posto del nome vero, e che un genitore può
scrivere e ottenere la rimozione senza dover dimostrare nulla.

Il modulo «Prenota un abitante» **resta fuori da tutto questo**: vi accede solo
chi partecipa alla residenza VIHTA, e i partecipanti sono maggiorenni (§15.4).

### Conservazione e cancellazione automatica

| Cosa | Quando | Come |
|---|---|---|
| Prenotazioni oltre 30 giorni | Ogni notte | Si recide il legame con l'utente. Restano il conteggio, la sede e — se il consenso è attivo — i cinque valori facoltativi copiati nei campi `stat_` (§5.3), senza sapere di chi fossero. |
| Account senza accessi da 24 mesi | Ogni notte | Avviso via email a 23 mesi; cancellazione a 24. **L'avviso è condizione della cancellazione:** un account che non è stato avvisato almeno un mese prima non viene chiuso, viene avvisato. Serve a un giro rimasto spento a lungo, che alla ripartenza deve avvisare e non cancellare tutti in una notte. |
| Richieste di accesso mai completate | Ogni notte | Cancellate dopo 24 ore |
| Link di accesso | 15 minuti | Non più utilizzabili; non ne resta traccia |
| Impronte delle richieste di link (§6.1) | 1 ora | Cancellate. Sono hash con chiave, non indirizzi: nessuna email o indirizzo di rete viene conservato |
| Registro delle moderazioni (§5.9) | Alla cancellazione dell'account | Le righe della persona spariscono insieme al suo account |
| Log tecnici | 30 giorni | Cancellati. Non devono contenere email in chiaro. |

**Queste cancellazioni dipendono da un'azione programmata che si può spegnere, e il segnale è il silenzio.** Il giro notturno è avviato da GitHub (§10, §14.5), e GitHub disattiva le azioni programmate di un repository pubblico dopo 60 giorni senza attività. A tenerlo acceso è `segno-di-vita.yml`, che scrive una data nel repository una volta al mese.

**Chi dovesse proteggere il ramo `main` contro le scritture dirette deve prevedere un'eccezione per quell'azione.** Senza eccezione la scrittura mensile viene rifiutata, e l'unico segnale è un'esecuzione rossa il primo del mese: due mesi dopo l'anonimizzazione a 30 giorni smette di avvenire, in silenzio. Al 13/09/2026 `main` non è protetto e il problema non si pone.

### Diritti dell'interessato: dove si esercitano

| Diritto                                   | Come                                                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accesso (art. 15) e portabilità (art. 20) | Pulsante "Scarica i miei dati", in fondo alle impostazioni personali → file JSON immediato. Contiene: il profilo (email, nome pubblico e sua visibilità, i cinque campi facoltativi, lingua, data di creazione, data dell'ultimo accesso), le prenotazioni ancora collegate alla persona — anche quelle passate e quelle annullate — con sede, comune, giorno, fascia, orario, stato e data della prenotazione, e le proprie righe del registro dei consensi. Non contiene il numero interno del posto (§8.1), non contiene i campi `stat_` delle prenotazioni anonimizzate — dopo la copia non sono più un suo dato (§5.3) — e non contiene il registro delle moderazioni, che resta dell'amministratore (§5.9, decisione del 11/09) |
| Rettifica (art. 16)                       | L'utente modifica da solo nome pubblico, eta, genere, professione, motivo visita, residenza e lingua. Per l'email: cambio con verifica del nuovo indirizzo. |
| Cancellazione (art. 17)                   | Pulsante "Cancella il mio account", accanto al precedente → una pagina di conferma che scrive per esteso cosa succede e quante prenotazioni verranno annullate → esecuzione immediata, non richiesta a un umano. Nessuna email di conferma: dopo la cancellazione non c'è più un indirizzo a cui scrivere, e la persona ha appena letto l'esito a schermo |
| Revoca del consenso (art. 7.3)            | Due consensi indipendenti (§5.5). Nome pubblico: interruttore nelle impostazioni, effetto immediato e retroattivo. Dati facoltativi: pulsante "Rimuovi i miei dati facoltativi", che svuota tutti e cinque i campi. Entrambe le revoche sono immediate, non richiedono l'intervento di un umano e non incidono sulle prenotazioni |
| Opposizione, limitazione                  | Via email al titolare, indirizzo indicato nell'informativa                                                                                                  |

### Adempimenti fuori dal software

==Da fare comunque, non risolvibili con il codice:

1. **Informativa privacy** in italiano e inglese, linkata prima della registrazione.
2. **Voce nel registro dei trattamenti** dell'APS (art. 30). L'esonero per le organizzazioni piccole non si applica: il trattamento è sistematico, non occasionale.
3. **Accordi con i fornitori** (DPA) con Supabase, Cloudflare, Resend. Moduli standard, da accettare e archiviare. È il vincolo che ha deciso l'ospite: vedi D25.
4. **Nota interna** che motiva perché non serve una valutazione d'impatto (DPIA): nessuna categoria particolare di dati, nessun monitoraggio sistematico su larga scala, numeri contenuti.

---

## 8. Casi limite e regole di integrità

### 8.1 Due persone prenotano l'ultimo posto nello stesso istante

Il caso critico dell'intero sistema. Un controllo del tipo "conta le prenotazioni, se sono meno della capienza inserisci" **non funziona**: due richieste simultanee contano entrambe lo stesso numero e inseriscono entrambe.

Soluzione adottata: ogni prenotazione riceve un `posto_progressivo` da 1 a capienza, e la banca dati impone che la combinazione `(sede, data, fascia, posto_progressivo)` sia **unica fra le prenotazioni attive**: una prenotazione annullata libera il proprio numero, che può essere riassegnato. Il vincolo è imposto dal database stesso, non dal programma: la seconda richiesta viene rifiutata a livello di archivio, ed è tecnicamente impossibile scavalcarla. L'applicazione riprova con il numero successivo finché ce ne sono; quando finiscono, comunica "non ci sono più posti".

L'utente non vede mai il numero: per lui esiste solo "un posto".

Va scritto un test automatico che simuli richieste simultanee e verifichi che non si superi mai la capienza.

### 8.2 Riduzione della capienza con prenotazioni già presenti

Se un amministratore abbassa la capienza sotto il numero di prenotazioni già attive: il sistema **non cancella nulla in automatico**. Mostra l'elenco dei giorni in eccesso e chiede all'amministratore di intervenire, avvisando le persone. La cancellazione automatica di una prenotazione altrui non deve mai avvenire senza un umano che se ne assume la responsabilità.

### 8.3 Le regole di visibilità stanno nella banca dati

Ogni regola su chi vede cosa (§4) va imposta come politica di accesso a livello di archivio dati, non come controllo nelle pagine. Conseguenza pratica: anche se un domani una pagina venisse scritta male, i dati altrui restano irraggiungibili.

Serve una suite di test che, impersonando un utente qualunque, provi a leggere le prenotazioni di un altro e verifichi che l'accesso fallisca.

### 8.4 Altri casi

| Situazione | Comportamento |
|---|---|
| Chiusura inserita su un giorno con prenotazioni | Avviso all'amministratore, elenco delle persone da avvisare, nessuna cancellazione automatica |
| Utente cancella l'account con prenotazioni future | Le prenotazioni ancora annullabili — quelle la cui fascia non è ancora cominciata (§6.4) — vengono annullate e i posti liberati. **Tutte** le prenotazioni della persona vengono poi anonimizzate **senza copiare** i campi `stat_` (§5.3): dopo la cancellazione non ne resta nessuna collegata a lei. Una fascia già cominciata non viene annullata e resta anonimizzata: quella presenza c'è stata, e continua a contare nei conteggi di occupazione. |
| Doppio clic sul pulsante "prenota" | Una sola prenotazione (protezione contro l'invio ripetuto) |
| Link di accesso già usato | Messaggio chiaro e possibilità di richiederne un altro |
| Cambio di ora legale | Le fasce sono orari locali, non istanti assoluti |
| Sede senza connessione | Resta consultabile l'ultima **disponibilità** scaricata, con la data dell'aggiornamento e l'avviso che potrebbe non essere aggiornata. Vale su qualunque browser recente, che l'app sia installata sulla schermata Home o no. «Chi c'è in Valle» **non** si conserva sul telefono: §6.5 promette che un nome pubblico spento sparisce subito da tutte le prenotazioni, e una copia salvata su un telefono altrui lo terrebbe in vita. Prenotare richiede connessione. |
| Prenotazione inviata a cavallo della mezzanotte | La finestra viene ricalcolata al momento della scrittura sul database, non al caricamento della pagina. Una richiesta partita alle 23:59 per il giorno appena uscito dalla finestra viene rifiutata con un messaggio chiaro. |
| Calcolo di "oggi" | Sempre in fuso `Europe/Rome`. Un server in orario universale considererebbe ancora "ieri" fino alle 02:00 italiane in ora legale, aprendo o chiudendo la finestra nel giorno sbagliato. |
| Periodo di attività accorciato con prenotazioni dentro | Nessuna cancellazione automatica. L'amministratore vede l'elenco delle prenotazioni rimaste fuori stagione e decide. Stessa regola di §8.2. |
| Sede che esce dal periodo con prenotazioni future | Le prenotazioni restano valide e visibili al loro titolare. La sede sparisce dalla vista di ricerca, non dalle prenotazioni già confermate. |
| Nome pubblico azzerato dall'amministratore | Le prenotazioni restano attive e valide. Sparisce solo il nome dalle pagine pubbliche. L'utente riceve l'avviso di §6.5. |
| Utente che supera `MAX_CAMBI_NOME_GIORNO` | Il nome non si può cambiare fino al giorno successivo. Messaggio esplicito con l'ora in cui sarà di nuovo possibile. Nessuna email parte all'amministratore. |
| Utente che revoca i dati facoltativi | I cinque campi del profilo vengono svuotati subito e non verranno più copiati su nessuna prenotazione. I valori già copiati nei campi `stat_` di prenotazioni anonimizzate **restano**: non sono più riconducibili a lui, quindi non sono più un suo dato personale. Va detto nell'informativa. |
| Registrazione con tutti i campi facoltativi vuoti | Registrazione completata normalmente. Nessuna sollecitazione successiva, nessun banner ricorrente. |
| Prenotazione fatta dopo l'ora del promemoria, per il giorno dopo | Nessun promemoria: il giro di quella sera è già passato e il successivo guarda al giorno dopo ancora. La persona ha appena letto la conferma a schermo (§6.3). |
| Chiusura inserita dopo la prenotazione | Il promemoria parte lo stesso. La prenotazione resta valida finché una persona non interviene (§8.2). |
| Invio del promemoria non riuscito | Quel promemoria è perso, e il giro del giorno dopo non lo recupera. Scelta deliberata: la riga è segnata come presa in carico prima che il fornitore di posta confermi, perché un promemoria doppio è peggio di un promemoria mancato (§6.3). |

---

## 9. Fuori dall'MVP

Da non costruire ora. In ordine di priorità:

1. ==**Etichette di competenze e interessi** accanto al nome pubblico ("grafica", "analisi dati", "cerco compagni di escursione"). È il passaggio da "so chi c'è" a "so con chi mi conviene incrociarmi".
2. **File per il calendario** (`.ics`) da scaricare dalla pagina di conferma e da "Le mie prenotazioni", per tenersi occupato lo slot nella propria agenda. Era un allegato dell'email di conferma finché quell'email è esistita; con il passaggio al promemoria della sera prima (§6.3, decisione del 10/09) l'allegato non aveva più senso — arriverebbe quando l'agenda serve a poco — e diventa un pulsante dentro l'app, che funziona subito e non dipende dalla posta.
3. **Check-in con QR in sede** e liberazione automatica del posto dopo 30 minuti di assenza.
4. ==**Lista d'attesa** con avviso automatico quando si libera un posto. Vale per le postazioni e, dal 12/09, anche per le attività di §15: era stata prevista per quelle ed è stata scartata (D22, §15.7).
5. **Prenotazioni ricorrenti** ("ogni martedì mattina fino a dicembre"). ⚠️ Incompatibile con la finestra di prenotazione (D8): una ricorrenza che generasse prenotazioni oltre la finestra la aggirerebbe. Se in futuro si vorrà questa funzione, andrà ripensata come *promemoria* ("ricordami ogni lunedì di prenotare per il martedì") anziché come prenotazione anticipata — oppure si dovrà rivedere D8.
6. **Bot Telegram** per notifiche e prenotazione rapida.
7. **Inglese e francese** (l'MVP è solo in italiano, ma i testi vanno tenuti separati dal codice fin da subito per non dover riscrivere tutto).
8. **Postazioni differenziate** (monitor, sala silenziosa, sala riunioni), se e quando ci saranno.
9. **Collegamento con gli eventi** di MontagneOltre e della valle.

---

## 10. Parametri configurabili

Valori che devono essere modificabili senza toccare la logica del programma. Vivono in un unico file di configurazione (`config/limits.ts`): cambiarli richiede un rilascio, non una riscrittura. `FINESTRA_GIORNI` ha una copia nel database, usata dalle regole di accesso del referente; un test automatico verifica che le due copie coincidano.

| Parametro | Valore iniziale |
|---|---|
| `FINESTRA_GIORNI` — giorni prenotabili oltre oggi | **14** |
| `ORA_APERTURA_FINESTRA` — ora in cui si apre il nuovo giorno | **00:00** (Europe/Rome) |
| `MAX_PRENOTAZIONI_ATTIVE` — massimo prenotazioni attive per utente | **nessun limite** (D7) |
| `MAX_PRENOTAZIONI_SETTIMANA` — massimo prenotazioni a settimana per utente | **nessun limite** (D7) |
| `VALIDITA_LINK_MINUTI` — validità del link di accesso | 15 minuti |
| `MAX_LINK_PER_EMAIL_ORA` — richieste di link per email all'ora | **5** |
| `MAX_LINK_PER_RETE_ORA` — richieste di link per indirizzo di rete all'ora | **20** |
| `DURATA_SESSIONE_GIORNI` — durata della sessione | 30 giorni dall'ultimo utilizzo |
| `GIORNI_ANONIMIZZAZIONE` — giorni prima dell'anonimizzazione | 30 |
| `MESI_ACCOUNT_DORMIENTE` — mesi prima della cancellazione di un account dormiente | 24 |
| `MESI_AVVISO_DORMIENZA` — mesi di inattività dopo cui parte l'avviso (§7) | **23** |
| `ORE_RICHIESTE_INCOMPLETE` — ore dopo cui sparisce una richiesta di link mai usata (§6.1) | **24** |
| `MESI_CONSERVAZIONE_CONSENSI` — mesi di conservazione del registro dei consensi dopo la chiusura dell'account (§7) | **24** |
| `EMAIL_MODERAZIONE` — destinatario degli avvisi sui nomi pubblici (§6.5) | da definire, casella del Direttivo, **mai un indirizzo personale** |
| `EMAIL_MITTENTE` — mittente di tutte le email dell'app (D12) | `noreply@wildworking.sassifraga.org` |
| `MAX_CAMBI_NOME_GIORNO` — modifiche del nome pubblico per utente al giorno | **3** |
| `ORA_PROMEMORIA` — ora in cui parte il promemoria del giorno dopo (§6.3) | **18:00** (Europe/Rome) |
| `ORA_PULIZIE` — ora in cui girano le pulizie notturne (§7) | **03:00** (Europe/Rome) |
| `SOGLIA_ULTIMI_POSTI` — posti liberi da cui la cella avvisa "ultimo posto" | **1** |
| `MINUTI_COPIA_VECCHIA` — minuti dopo cui la disponibilità a schermo si dichiara non più aggiornata (§8.4) | **30** |
| `URL_INFORMATIVA_PRIVACY` — indirizzo dell'informativa linkata prima dell'accesso (§6.1) | da definire, pagina su `www.sassifraga.org` |

I parametri del modulo «Prenota un abitante» stanno in §15.13 e vivono nello stesso file.

**`FINESTRA_GIORNI` è una fonte di verità unica.** Governa insieme la validazione della prenotazione, la vista di disponibilità e la pagina pubblica. I tre valori devono coincidere per costruzione, non essere impostati separatamente: altrimenti l'app finirebbe per mostrare giorni non prenotabili o nascondere giorni prenotabili.

**`ORA_PROMEMORIA` è un'intenzione, non un orologio al minuto.** Il giro parte una sola volta al giorno, alle 16:26 in orario universale, cioè le 18:26 italiane d'estate e le 17:26 d'inverno. Per un promemoria serale quell'ora di scarto non cambia nulla, e costa una esecuzione al giorno invece di ventiquattro. Lo stesso vale per `ORA_PULIZIE`, programmato allo stesso modo alle 01:41 universali, cioè le 03:41 italiane d'estate e le 02:41 d'inverno: le pulizie di §7 ragionano in giorni e in mesi interi, calcolati in `Europe/Rome`, e il minuto in cui partono non cambia il loro esito.

**La programmazione vive fuori dall'applicazione.** Su Cloudflare non può stare dentro: un Cron Trigger chiama un Worker e non un indirizzo qualsiasi (D25). I due giri sono quindi fatti partire da altrettante azioni programmate di GitHub (`.github/workflows/promemoria.yml` e `pulizie.yml`), che chiamano i due indirizzi dall'esterno, solo in `https`, presentando il `CRON_SECRET`. Le espressioni degli orari sono scritte in orario universale, e **chi cambia `ORA_PROMEMORIA` o `ORA_PULIZIE` deve cambiare anche l'espressione dell'azione corrispondente: le due non si allineano da sole.**

**I minuti sono scelti, non casuali.** GitHub fa partire le azioni programmate in ritardo quando è carico, e dichiara che fra i momenti peggiori ci sono gli inizi d'ora — che sono anche il punto dove si accalca quasi ogni programmazione scritta a mano. I due giri stanno quindi a metà ora e su minuti che nessuno sceglie per abitudine. Resta comunque un'intenzione e non un orologio: un ritardo non cambia l'esito delle pulizie, e per il promemoria della sera prima vale §6.3 — meglio perso che doppio.

**Un'azione programmata di GitHub si spegne da sola.** GitHub disattiva le azioni programmate di un repository pubblico dopo 60 giorni senza attività, e due mesi senza un commit sono del tutto normali per un'associazione di volontari. Se si fermano le pulizie si ferma anche l'anonimizzazione a 30 giorni (§5.3, §7), e si ferma in silenzio: nessuna esecuzione rossa, nessun avviso. Per questo una terza azione (`.github/workflows/segno-di-vita.yml`) scrive una data nel repository una volta al mese, così i sessanta giorni non scadono mai. Se quella terza azione fallisce va guardata subito: il suo silenzio precede quello delle pulizie.

**`ORA_APERTURA_FINESTRA` esiste per un problema prevedibile.** Con una finestra mobile, nei periodi di punta i posti del nuovo giorno si esauriranno subito dopo l'apertura, premiando chi sta sveglio. Con 14 giorni e le capienze attuali è improbabile che accada subito, quindi il valore iniziale è mezzanotte. Se dovesse diventare un problema di equità, si sposta l'apertura a un'ora civile (es. 08:00) cambiando un parametro, senza toccare il codice.

---

## 11. Decisioni ancora aperte

### A. Dati mancanti da raccogliere - Update al 10/09: dati raccolti e compilati

**Capienza ufficiale di ciascuna sede. Nota: dev'essere comunque modificabile dal pannello di amministrazione**

Contatto privacy: Letizia Melano

| Sede               | **Capienza ufficiale di ciascuna sede. Nota: dev'essere comunque modificabile dal pannello di amministrazione** | Orari e giorni di apertura effettivi | Sede stagionale? | Indirizzi esatti | Referente Sede |     |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------- | ---------------- | -------------- | --- |
| Ronco Coworking    | 6 persone                                                                                                       | 09:00 - 18:00, lun-sab               | No               | Ancora ND        | Ancora ND      |     |
| Valprato Coworking | 4 persone                                                                                                       | 09:00 - 18:00, lun-sab               | Sì               | Ancora ND        | Ancora ND      |     |
| Valprato Comune    | 8 persone                                                                                                       | 09:00 - 18:00, lun-sab               | Sì               | Ancora ND        | Ancora ND      |     |
| Ingria Coworking   | 4 persone                                                                                                       | 09:00 - 18:00, lun-sab               | Sì               | Ancora ND        | Ancora ND      |     |
| Pigna              | 6 persone                                                                                                       | 09:00 - 18:00, lun-sab               | Sì               | Ancora ND        | Ancora ND      |     |
| Bar Soana          | 6 persone                                                                                                       | 09:00 - 18:00, lun-sab               | Sì               | Ancora ND        | Ancora ND      |     |

Comuni: Ronco Coworking e Bar Soana → Ronco Canavese; Valprato Coworking, Valprato Comune e Pigna → Valprato Soana; Ingria Coworking → Ingria. Le sedi stagionali non hanno ancora i periodi: finché non vengono inseriti dal pannello, i dati di sviluppo usano un periodo segnaposto (1 giugno – 30 settembre, ricorrente) etichettato "da confermare".


### B. Da valutare

- Serve una **conferma dell'email** prima della prima prenotazione? Con il link magico la verifica è implicita (per entrare devi accedere alla casella): probabilmente no. -> Update 10/09: no.
- Il **nome pubblico va moderato**? → **Deciso**: sì. Moderazione successiva, con filtro automatico, avviso all'amministratore e azione di azzeramento. Vedi D14 e §6.5: non è più una decisione aperta.
- Le  sedi vanno mostrate anche su **mappa**? Utile per chi non conosce la valle. Costo basso. -> Update: forse in uno sviluppo futuro.

### C. Rimandato a dopo il rilascio

Non sono cose dimenticate: sono cose che si possono fare **dopo** che il
prototipo è in mano alle persone, senza che nulla vada perduto nel frattempo.
Aggiornato all'11/09, chiuso il passo 13.

**Contenuti che mette una persona, dal pannello**

- **Elenco dei termini vietati** (§5.8). Nasce vuoto. Finché è vuoto il primo
  livello di §6.5 non ferma niente, e reggono gli altri due — l'avviso
  all'amministratore e l'azzeramento — più i divieti automatici su link,
  indirizzi email e numeri di telefono, che non dipendono dall'elenco. Si
  compila con calma, guardando i nomi che arrivano davvero: un elenco scritto
  a tavolino contiene parole che nessuno userebbe e non contiene quelle che
  serviranno.
- **Periodi di attività definitivi** delle cinque sedi stagionali (§5.7,
  §11.A). Al rilascio si inserisce quello che si sa; il resto si corregge dal
  pannello in meno di un minuto, che è esattamente perché sono dati e non
  codice (D9).
- **Capienze e orari definitivi** (§11.A): i valori di §11.A sono quelli
  raccolti il 10/09 e vanno confermati dai Comuni.
- **Incarichi di referente** (§5.6): i nomi non sono ancora stati raccolti. La
  vista del referente esiste e resta vuota finché non si assegna nessuno.

**Funzioni**

- **Passo 12 — statistiche ed esportazione** (§6.8), con
  `tests/statistiche.test.ts`. Si riprende quando serve la prima
  rendicontazione ad APICE. Tutto ciò che non si recupera più tardi — i campi
  `stat_` (§5.3), i conteggi delle persone distinte (§6.8) e i posti offerti
  (§5.10) — è già in esercizio dal passo 11 e si accumula da solo, anche senza
  nessuna schermata che lo legga.
- **Cancellazione di un account dal pannello** (§6.7). La voce c'è, spenta. I
  due diritti che la legge impone di rendere immediati sono già nelle
  impostazioni della persona (§7); questa schermata serve solo alle richieste
  che arrivano per iscritto da chi non riesce più ad accedere alla propria
  casella, che è il caso raro.
- **Le nove voci di §9**, che restano fuori dall'MVP per scelta e non per
  dimenticanza. Fra queste **inglese e francese**: i testi sono già tutti in
  `messages/it.json`, separati dal codice, e il campo `lingua` esiste — manca
  la traduzione, non il posto dove metterla.
- **Mappa delle sedi** (§11.B), se si deciderà di farla.

**Materiali** (§13.10)

- Logo in formato vettoriale, versione del logo per fondo verde, e **icona
  disegnata per il telefono**: quella in uso è provvisoria, ricavata dal logo
  PNG. Si sostituiscono i file e nient'altro.

**Cose da guardare con l'uso vero**

- **L'apertura a tutto schermo su iPhone precedenti a iOS 17.4.** L'app scrive
  il contrassegno moderno; quelli vecchi capiscono solo il contrassegno
  storico di Apple. Si aggiunge una riga, se la prova su un iPhone vero mostra
  che serve.
- **`ORA_APERTURA_FINESTRA`** (§10) resta a mezzanotte finché la corsa al
  posto non diventa un problema di equità. Allora si sposta a un'ora civile
  cambiando un parametro.
- **Il tetto giornaliero di invii** del fornitore di posta (§14.2), che è
  condiviso fra promemoria e avvisi di moderazione.
- **Una pagina intermedia "Entra"**, se i filtri antispam di qualche azienda
  apriranno i link di accesso al posto delle persone, consumandoli.

---

## 12. Ordine di costruzione

1. Struttura dei dati e politiche di accesso, con i test di §8.1 e §8.3
2. Accesso via link email (le due pagine nascono senza stile e vengono vestite al passo 3)
3. **Identità visiva: file dei token (§13)** — prima di qualsiasi schermata definitiva
4. Visualizzazione della disponibilità (senza registrazione)
5. Prenotazione e annullamento
6. Impostazioni personali: nome pubblico e consenso
7. Pagina pubblica "Chi c'è" — insieme ai **due collegamenti reciproci** con la pagina della disponibilità (§6.2 e §6.6), lasciati fuori dal passo 4 perché la pagina di destinazione non esisteva ancora
8. Pannello di amministrazione
9. Email automatiche: il promemoria della sera prima (§6.3) e i due avvisi di moderazione (§6.5). Porta con sé il programmatore di orari su cui si appoggeranno le pulizie del passo 11
10. Diritti dell'interessato: scarica dati, cancella account
11. Pulizie automatiche notturne, e con loro l'annotazione dei posti offerti (§5.10): non è una pulizia, ma è l'unica cosa del passo 12 che va messa in esercizio prima del rilascio, perché il suo dato non si recupera dopo
12. Statistiche ed esportazione
13. Installabilità sul telefono e funzionamento offline in lettura: manifesto e icona per la schermata Home, copia locale della sola disponibilità con l'avviso di §8.4, e una pagina che spiega come si installa — su iPhone non lo propone nessuno

Ogni passo si considera concluso solo quando funziona, è salvato nel controllo di versione, e i test passano.

I passi dal 14 al 20 costruiscono il modulo «Prenota un abitante» e stanno in §15.14, uno per sessione di lavoro.

**Nota dell'11/09.** Il passo 12 è rimandato a dopo il rilascio del prototipo, e si riprende quando serve la prima rendicontazione. Non ha vincoli che obblighino a farlo prima: tutto ciò che non si recupera più tardi — i campi `stat_` (§5.3), i conteggi delle persone distinte (§6.8) e i posti offerti (§5.10) — entra in esercizio col passo 11 e si accumula da solo, anche senza nessuna schermata che lo legga. L'ordine effettivo è quindi 11, 13, 12.

---

## 13. Identità visiva

Fonte: sito `www.sassifraga.org` (Google Sites), schermate desktop e mobile di Home, Chi siamo e VIHTA, logo ufficiale.

### 13.1 Principio

**Chi passa dal sito all'app non deve avere il dubbio di essere finito altrove.** Stesso logo, stessi colori, stesso carattere, stesso tono.

L'app contiene però elementi che sul sito non esistono — pulsanti, griglie, campi, messaggi di errore, interruttori di consenso. Per quelli non c'è nulla da copiare: vanno inventati **in coerenza**, non evitati. Restare dentro i limiti espressivi di Google Sites produrrebbe uno strumento peggiore per assomigliare a un sito che è più semplice solo perché costruito con un attrezzo più semplice.

I valori marcati **[dato]** provengono dall'associazione. Quelli marcati **[derivato]** sono stati ricavati per necessità funzionale e vanno confermati.

### 13.2 I due stili

L'identità ha due configurazioni:

- **Stile 1 — chiaro**: sfondo crema, testo quasi nero. È il registro **predefinito dell'app**: tutte le schermate operative, la griglia di disponibilità, i moduli, il pannello di amministrazione.
- **Stile 2 — verde**: sfondo verde pieno, testo quasi nero. È un registro **d'accento**, per blocchi interi e occasionali: il pulsante di azione principale, la fascia della pagina pubblica "Chi c'è", gli stati vuoti, la schermata di conferma dopo una prenotazione.

**Regola:** lo Stile 2 non si usa mai per contenuti densi o informativi — griglia di disponibilità, tabelle, elenchi, moduli. Su una superficie verde satura la gerarchia tra informazione principale e secondaria collassa, e la griglia diventa faticosa da leggere. Serve a dare ritmo, non a portare dati.

### 13.3 Colori

| Token | Valore | Uso | Origine |
|---|---|---|---|
| `sfondo` | `#EBE8DD` | Sfondo di tutta l'app | **[dato]** |
| `testo` | `#1C1C1C` | Titoli e testo corrente | **[dato]** |
| `verde` | `#3FB75A` | Riempimenti, logo, fasce Stile 2, elementi grafici ampi | **[dato]** |
| `verde-testo` | `#1A6B31` | Collegamenti e testo verde su sfondo chiaro | **[derivato]** — vedi §13.7 |
| `testo-secondario` | `#5A564C` | Etichette, note, testo di supporto | **[derivato]** |
| `linea` | `#D6D2C4` | Righe di separazione, bordi dei campi | **[derivato]** |
| `superficie` | `#F3F1E9` | Celle della griglia, aree leggermente rilevate | **[derivato]** |
| `superficie-scura` | `#E0DCCD` | Celle non prenotabili, giorni chiusi | **[derivato]** |
| `avviso` | `#8A5410` | "Ultimi posti", avvertenze non bloccanti | **[derivato]** |
| `errore` | `#A32020` | Errori di validazione, azioni fallite | **[derivato]** |

Nessun altro colore. Non esistono grigi generici, blu di sistema, o verdi diversi da questi due.

**Testo sui riempimenti verdi:** sempre `testo` (`#1C1C1C`), mai bianco. Il bianco su `#3FB75A` ha un contrasto di 2,6:1 e non è leggibile. Il nero su verde arriva a 6,6:1 — ed è esattamente l'abbinamento dello Stile 2.

### 13.4 Tipografia

**Inclusive Sans** per tutto: titoli, testo, numeri, pulsanti. Nessun secondo carattere.

- Il carattere va **ospitato sul nostro dominio**, non caricato dai server di Google. Richiamarlo dai Google Fonts trasmetterebbe l'indirizzo IP di ogni visitatore a Google, cosa che vanifica la scelta di non avere terze parti e la conseguente assenza di banner dei cookie.
- Usare solo i pesi effettivamente disponibili nel file (regolare e grassetto, più i corsivi). Nessun disegno deve dipendere da pesi intermedi.
- Il **corsivo** esiste nell'identità: il sito lo usa per i testi di presentazione. Nell'app va riservato allo stesso registro — testi introduttivi — mai a etichette o dati.
- Inclusive Sans ha lo **zero barrato**, ben visibile nel sito. È un vantaggio in un'interfaccia piena di date e conteggi: i numeri restano inequivocabili. Non va corretto o disattivato.

Scala tipografica di partenza **[derivato]**: testo corrente 18px, note 15px, titoli di sezione 24px, titolo di pagina 32px su telefono e 44px su schermo grande. Il sito lavora con corpi generosi: non rimpicciolire.

### 13.5 Forma e spazio

Il sito è **piatto e arioso**: nessuna ombra, nessun riquadro, nessun contenitore arrotondato. Le sezioni sono separate da sottili righe orizzontali e da molto spazio vuoto.

L'app segue lo stesso principio **[derivato]**:

- Nessuna ombra. Nessun bordo spesso. La separazione si ottiene con lo spazio e con righe da 1px in `linea`.
- Angoli arrotondati minimi: 4px su pulsanti e campi, 0 sulle righe di separazione.
- Spaziature multiple di 4px, con margini verticali abbondanti tra le sezioni.
- Nessuna icona decorativa. Le icone si usano solo dove sostituiscono una parola con guadagno di chiarezza.

Deroga necessaria: la **griglia di disponibilità** ha bisogno di celle riconoscibili. Si realizzano con `superficie` e righe in `linea`, non con riquadri ombreggiati.

### 13.6 Collegamenti e pulsanti

Il sito non ha pulsanti: usa collegamenti verdi sottolineati. L'app ne ha bisogno, quindi **[derivato]**:

- **Collegamenti**: `verde-testo`, sempre sottolineati. Mai verde chiaro (§13.7). Sui blocchi Stile 2 i collegamenti sono in `testo`, sottolineati: `verde-testo` sul verde non è leggibile (2,6:1).
- **Azione principale** (Prenota, Conferma): riempimento `verde`, testo `testo`, angoli 4px.
- **Azione secondaria**: contorno in `testo`, sfondo trasparente.
- **Azione distruttiva** (Annulla prenotazione, Cancella account): testo in `errore`, senza riempimento.
- Ogni elemento cliccabile ha un'area di tocco di almeno 44×44px: si usa da telefono, spesso all'aperto.

### 13.7 Accessibilità

**Un problema ereditato, da non replicare.** Il sito usa il verde `#3FB75A` per i collegamenti su sfondo crema. Quell'abbinamento ha un contrasto di **2,1:1**, molto sotto il minimo di 4,5:1 richiesto per il testo: è difficile da leggere per chi ha vista ridotta e in condizioni di luce forte. Per un servizio pubblico rivolto anche a persone anziane in valle non è accettabile.

Per questo esiste `verde-testo` (`#1A6B31`, contrasto 5,4:1). Appartiene alla stessa famiglia cromatica, si legge come "il verde di Sassifraga", ed è leggibile. Il verde chiaro resta per riempimenti, logo e superfici ampie, dove il problema non si pone.

Regole vincolanti:

- Ogni testo raggiunge almeno 4,5:1 sul proprio sfondo.
- **Nessuna informazione è veicolata dal solo colore.** Disponibilità, esaurimento e chiusura hanno sempre anche un'etichetta testuale: "4 posti liberi", "ultimi 2", "esaurito", "chiuso". Chi non distingue i colori deve capire tutto ugualmente.
- Ogni elemento raggiungibile da tastiera ha un contorno di messa a fuoco visibile.
- L'app funziona con testo ingrandito dal sistema fino al 200% senza perdere contenuti.

### 13.8 Intestazione e piè di pagina

L'aggancio più forte alla continuità con il sito.

**Intestazione**: logo e dicitura "Comunità Sassifraga" a sinistra, come sul sito; il logo rimanda a `www.sassifraga.org`. Sfondo `sfondo`, nessuna ombra.

**Piè di pagina**: gli stessi dati istituzionali del sito — denominazione, codice fiscale 92527790015, sede legale in Piazza Municipio 2, Ronco Canavese, `info@sassifraga.org` — più i collegamenti all'informativa privacy dell'app e al sito principale.

### 13.9 Tono dei testi

Il sito parla in modo diretto, sobrio, non promozionale ("Lavoriamo con il territorio, non semplicemente sul territorio"). L'app fa lo stesso:

- Errori che dicono cosa fare, non cosa è andato storto: "Quel posto è appena stato preso. Prova con il pomeriggio o con un'altra sede."
- Nessun entusiasmo forzato, nessun punto esclamativo, nessuna emoji.
- Si dà del tu, come il sito.
- Nessun termine tecnico rivolto all'utente: mai "autenticazione", "token", "sessione scaduta".

### 13.10 Materiali ancora mancanti

| Cosa | Perché serve |
|---|---|
| Logo in formato vettoriale (`.svg`) | Il PNG sgrana su schermi ad alta densità e nelle dimensioni grandi |
| Versione del logo per sfondo verde | Il logo è verde su trasparente: sui blocchi Stile 2 sparirebbe. Serve in `#1C1C1C` o in `#EBE8DD` |
| Icona per l'installazione su telefono | Quadrata, 512×512px, logo su fondo pieno (crema o verde), con margine interno. **Provvisoria in uso**, ricavata dal logo PNG su fondo crema, come `public/logo.png`: si sostituisce insieme al logo definitivo |

---

## 14. Dominio, posta e collocazione

### 14.1 Indirizzo del servizio

Il servizio vive su **`wildworking.sassifraga.org`** (D11).

Non su `www.sassifraga.org/coworking`: il sito istituzionale è costruito con Google Sites, che non consente di dirottare una sottocartella verso un'applicazione esterna. Non è una limitazione aggirabile.

Il sottodominio si crea con un singolo record DNS presso il registrar di `sassifraga.org` e non tocca in alcun modo il sito esistente.

**Da non fare: incorporare l'app dentro una pagina del sito.** Google Sites permette di mostrare pagine esterne dentro un riquadro incorporato, ed è la strada che sembra dare più continuità. I browser moderni — Safari e iOS in particolare — bloccano però i cookie dei siti mostrati dentro un riquadro altrui: il cookie di sessione non sopravvivrebbe e **l'accesso smetterebbe di funzionare per tutti gli utenti iPhone**. In più l'app non sarebbe installabile sulla schermata Home. La continuità si ottiene invece con l'identità visiva (§13) e con una pagina "Coworking" sul sito che rimanda al sottodominio.

### 14.2 Posta in uscita

Tutte le email dell'app partono da **`noreply@wildworking.sassifraga.org`** (D12), mai dal dominio principale.

La ragione è concreta: `sassifraga.org` ha già i record di posta di Google Workspace. Aggiungere un secondo mittente autorizzato sul dominio principale, se fatto male, può far finire nello spam **anche la posta istituzionale di `info@sassifraga.org`** — un danno più grave del problema che si sta risolvendo. Autenticando un sottodominio separato, reputazione e configurazione restano isolate.

Tetti da tenere presenti: il piano gratuito del fornitore di posta transazionale ha un limite giornaliero di invii **condiviso** fra promemoria, avvisi di moderazione e avvisi di cancellazione. È il motivo per cui esiste `MAX_CAMBI_NOME_GIORNO` (§10). Il promemoria consuma al massimo un invio per persona e per giorno, non uno per prenotazione (§6.3).

### 14.3 Cosa resta sul sito istituzionale

Le pagine informative — presentazione del coworking, contatti, informativa privacy — restano su Google Sites, dove chiunque nel Direttivo può modificarle senza toccare codice. L'app costruisce solo le parti dinamiche: disponibilità, prenotazione, "Chi c'è in Valle", profilo, amministrazione.

### 14.4 Da verificare prima del rilascio

- **Chi controlla il registrar di `sassifraga.org`.** Serve accesso ai record DNS. Se è nelle mani di una sola persona o di un account personale, va spostato su un account dell'associazione con almeno due amministratori: perdere il dominio significherebbe perdere sito, posta istituzionale e app insieme.
- **L'informativa privacy dell'app è un documento nuovo**, non quella del sito: tratta dati diversi per finalità diverse. Va linkata dall'app prima della registrazione (§6.1).
- **Il sottodominio di posta va autenticato** presso il fornitore (record SPF, DKIM e DMARC su `wildworking.sassifraga.org`), e la chiave del fornitore va messa fra le variabili d'ambiente insieme al segreto del programmatore di orari e all'indirizzo `EMAIL_MODERAZIONE`. Finché la chiave manca, l'app non manda niente e non se ne accorge nessuno: il promemoria è l'unica email che una persona riceve dopo l'accesso, e la sua assenza non blocca nulla. Va quindi verificato a mano che il primo promemoria parta davvero.

### 14.5 Dove gira l'applicazione

L'applicazione gira su **Cloudflare Workers** (D25), costruita dall'adattatore `@opennextjs/cloudflare`. Il codice dell'applicazione non contiene niente di specifico dell'ospite: l'adattatore compila il progetto Next.js così com'è, verificato il 13/09/2026.

Il record DNS del sottodominio (§14.1) va agganciato come *Custom Domain* del Worker e **resta proxato** da Cloudflare, con la nuvoletta arancione accesa — il contrario di quanto valeva per l'ospite precedente, dove il record andava lasciato in sola risoluzione.

**I due giri notturni partono da fuori.** Su Cloudflare un Cron Trigger può chiamare soltanto un Worker, non un indirizzo qualsiasi, e il programma generato dall'adattatore espone solo la gestione delle richieste web: non c'è un rimpiazzo diretto della programmazione dell'ospite. I due giri sono quindi fatti partire da altrettante azioni programmate di GitHub, più una terza che impedisce alle prime due di essere spente per inattività. Come e perché sta in §10. **GitHub non riceve nessun dato personale**: chiama due indirizzi in `https` presentando il segreto condiviso, e quello che torna sono i conteggi di §6.3 e §7, senza un indirizzo, un nome o un identificativo.

**Il tetto del piano gratuito va rimisurato prima di ogni pubblicazione.** Cloudflare non accetta un Worker più grande di **3 MB compressi**. La prima misura, il 13/09/2026, era di 2 967 KiB **senza** il modulo «Prenota un abitante» (§15): un margine di un centinaio di KiB, che il modulo avrebbe consumato.

Due interventi sulla sola compilazione — nessuna riga dell'applicazione — l'hanno portata a **1 920 KiB** lo stesso giorno, con circa 1 150 KiB liberi. Sono l'accorciamento dei nomi interni, attivato in `wrangler.jsonc`, e la rimozione di `@vercel/og`, il generatore di immagini di anteprima che Next si porta dentro e che l'adattatore Cloudflare lascia nel programma anche quando nessuna pagina lo usa. La rimozione è fatta da `strumenti/alleggerisci-worker.mjs`, agganciato a `npm run cloudflare:build`; **la ragione per cui esiste non è il peso ma la privacy**, e sta scritta in testa a quel file e in `PROVA-CLOUDFLARE.md`.

**La compilazione usa Turbopack**, il costruttore predefinito di Next 16. Il vecchio costruttore, webpack, darebbe un programma più piccolo di altri 500 KiB, ed è stato scartato il 13/09/2026: è dichiarato una via d'uscita temporanea che Next 17 potrebbe togliere, e userebbe un costruttore diverso da quello di `npm run dev`, facendo divergere la prova in locale dal sito pubblicato. Il margine non serve a tanto.

---

## 15. Modulo «Prenota un abitante»

Secondo servizio, ospitato dentro la stessa applicazione di Wild Working (D17). Durante VIHTA gli abitanti della Valle Soana propongono attività da fare insieme ai residenti temporanei; l'amministratore le raccoglie e le pubblica; i residenti si iscrivono.

Edizione di riferimento: **20 settembre – 18 ottobre 2026**, 45 residenti attesi, 20–25 attività.

### 15.1 Perché dentro Wild Working e non a parte

Le due cose che si prenotano sono diverse — posti intercambiabili che si ripetono ogni giorno contro eventi unici — ma tutto ciò che costa da costruire è identico: accesso con link email, profilo, consensi, nome pubblico, moderazione, posta in uscita, anonimizzazione, campi `stat_`, struttura del pannello, token grafici.

Un servizio separato avrebbe significato un secondo progetto Supabase e un secondo ospite a pagamento, due informative, due serie di accordi con i fornitori, due superfici su cui può accadere un errore di privacy — e un residente costretto a registrarsi due volte, nella stessa settimana, per due servizi della stessa associazione.

**Il modulo è additivo.** Non modifica **nessuna delle nove tabelle esistenti**: l'abilitazione sta in una tabella sua, i consensi riusano i due tipi che già esistono (§5.5), l'amministratore è già globale (§5.6).

Additivo non vuol dire però che non si tocchi niente di ciò che è già in esercizio. **Si toccano sette cose**, e ognuna ha i propri test da estendere — non da riscrivere:

1. La **pagina della disponibilità**, che acquisisce in cima il pulsante di §15.5 (§6.2).
2. La pagina **«Le mie prenotazioni»**, che acquisisce una seconda sezione (§15.6).
3. L'elenco **"Prenotazioni da controllare"** del pannello, che accoglie anche le iscrizioni rimaste fuori da un cambio di capienza (§6.7, §15.12).
4. Il **giro notturno dei promemoria**, che acquisisce un secondo elenco senza diventare una seconda esecuzione (§15.10).
5. Il **giro notturno delle pulizie**, che acquisisce le tre pulizie di §15.11.
6. La **cancellazione dell'account** (art. 17), che deve liberare anche le iscrizioni e cancellare abilitazione e codice (§15.12).
7. L'**informativa privacy**, che diventa una versione nuova e datata (§15.11).

Chi legge "il modulo è additivo" e ne conclude che si costruisce in una sessione sola sbaglia i conti di un fattore cinque. Le cinque tabelle sono la parte facile; queste sette sono quella che porta via il tempo.

### 15.2 Quello che il modulo non eredita

**`FINESTRA_GIORNI` non si applica alle attività.** L'edizione dura 29 giorni; un residente che arriva il 20 settembre deve poter organizzare l'intero soggiorno, non solo i 14 giorni successivi. Le attività si mostrano **tutte**, per l'intera edizione. Forzarle nella finestra mobile romperebbe il servizio; allargare la finestra romperebbe il coworking.

Non si eredita nemmeno la **griglia**: 20–25 eventi unici sono un elenco cronologico, non una tabella di conteggi.

### 15.3 Struttura dei dati

Cinque entità nuove, che si aggiungono alle nove di §5, più una tabella di servizio (§15.3.6) che non è un'entità del dominio ma solo il contatore dei tentativi di inserimento del codice.

- Un'**edizione** è il periodo in cui il modulo è attivo. È l'interruttore temporale.
- Un'**attività** è un evento unico proposto da un abitante.
- Un'**iscrizione** collega un residente a un'attività.
- Un'**abilitazione** dice che un utente può accedere al modulo per una certa edizione.
- Un **codice d'invito** è il biglietto monouso che genera un'abilitazione.

#### 15.3.1 edizioni

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `nome` | testo | Es. "VIHTA 2026" |
| `data_inizio` | data | |
| `data_fine` | data | Inclusa |
| `attiva` | sì/no | Interruttore manuale, ha sempre la precedenza |

Il modulo è visibile se, e solo se, esiste un'edizione con `attiva` a sì **e** la data odierna cade fra `data_inizio` e `data_fine`. È la stessa logica dei periodi di attività delle sedi (§5.7, D9): la stagionalità è un dato modificabile dal pannello, mai una condizione scritta nel codice.

**Può esistere al massimo un'edizione attiva per volta.** Il sistema lo impone: attivarne una ne disattiva un'altra, con avviso esplicito.

#### 15.3.2 attivita

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `edizione_id` | riferimento a edizione | |
| `titolo` | testo, max 80 caratteri | |
| `descrizione` | testo, max 4000 caratteri | **Scritta dall'abitante**, non dall'associazione: racconta chi è e cosa propone, con le sue parole. L'amministratore la trascrive o la incolla così com'è. **Livello 1** |
| `abitante_nome` | testo, max 40 caratteri | Solo il nome di battesimo. **Livello 1** — lo vedono tutti gli abilitati |
| `abitante_cognome` | testo, max 60 caratteri | **Livello 2** — solo chi è iscritto a quella attività |
| `abitante_telefono` | testo, max 30 caratteri | **Livello 2** — solo chi è iscritto. Serve per la reperibilità nel giorno dell'attività |
| `abitante_note_interne` | testo, max 300 caratteri | Facoltativo. Email, orari in cui chiamare, accordi presi. **Solo amministratore**, mai mostrato a nessun residente, mai esportato |
| `luogo_generico` | testo, max 120 caratteri | Comune o frazione. Campo libero, senza elenco chiuso: la toponomastica della valle non sta in un menu a tendina. **Livello 1** |
| `luogo_esatto` | testo, max 200 caratteri | Indirizzo preciso. **Livello 2** — solo chi è iscritto, e nelle email che lo riguardano |
| `data` | data | Deve cadere dentro l'edizione |
| `ora_inizio` | ora | |
| `ora_fine` | ora | |
| `capienza` | numero >0 | |
| `cosa_portare` | testo, max 300 caratteri | Facoltativo. Scarponi, grembiule, contanti |
| `lingua_attivita` | testo, max 60 caratteri | Facoltativo. Utile ai residenti stranieri |
| `stato` | `BOZZA` / `PUBBLICATA` / `ANNULLATA` | |
| `consenso_raccolto` | sì/no | La spunta che l'amministratore mette dichiarando di avere in mano il consenso firmato (§15.8). Senza, l'attività non si pubblica |
| `consenso_raccolto_il` | data e ora | Scritta dal sistema quando la spunta viene messa |
| `consenso_raccolto_da` | riferimento a utente | Quale amministratore l'ha messa |
| `consenso_modalita` | `MODULO_CARTACEO_FIRMATO` / `EMAIL_DI_CONSENSO` | **Elenco chiuso, non campo libero.** O il modulo cartaceo firmato a mano, o un'email di consenso ricevuta da un indirizzo dell'abitante e conservata. Obbligatorio quando la spunta è messa (§15.8) |
| `creata_il` | data e ora | |

Regole:

- Un'attività in `BOZZA` non è visibile a nessun residente. L'amministratore le carica a mano, un po' per volta, e pubblica quando è pronto.
- **Non si può passare a `PUBBLICATA` se la spunta del consenso non è stata messa** (§15.8). Il sistema lo rifiuta con un messaggio esplicito. È il solo vincolo di questo tipo nel modulo, e c'è perché l'omissione è invisibile finché non diventa un problema.
- **La descrizione va riletta prima di pubblicare.** È testo scritto da un'altra persona: può contenere un numero di telefono, l'indirizzo di casa, il nome di un familiare. Nessun filtro automatico può accorgersene. Il pannello lo ricorda al momento della pubblicazione (§15.9).
- La data deve cadere dentro l'edizione. Fuori, il sistema rifiuta.

#### 15.3.3 iscrizioni

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `attivita_id` | riferimento a attività | |
| `utente_id` | riferimento a utente | |
| `stato` | `ATTIVA` / `ANNULLATA` | **Due soli stati.** Non esiste `IN_ATTESA`: la lista d'attesa è stata scartata (D22) |
| `posto_progressivo` | numero da 1 a capienza | Solo per le iscrizioni `ATTIVA`. Assegnato dal sistema, **mai mostrato** |
| `creata_il` | data e ora | |
| `creata_da` | riferimento a utente | Chi ha creato l'iscrizione: di norma l'interessato stesso, l'amministratore quando iscrive per conto di qualcuno (§15.9) |
| `annullata_il` | data e ora | |
| `annullata_da` | riferimento a utente | Chi l'ha annullata: l'interessato, o l'amministratore (§15.9) |
| `anonimizzata` | sì/no | Come §5.3: diventa sì quando la **data dell'attività** è più vecchia di `GIORNI_ANONIMIZZAZIONE` |
| `stat_eta`, `stat_genere`, `stat_professione`, `stat_motivo_visita`, `stat_residenza` | come §5.3 | Stessa identica regola di copia di §5.3, comprese le eccezioni |

**Il doppio posto si impedisce come per le prenotazioni** (§8.1): unicità su `(attivita_id, posto_progressivo)` per le sole iscrizioni attive, imposta dal database e non dal codice. Stessa regola, stesso test, nessuna invenzione nuova.

Un utente non può avere più di un'iscrizione non annullata sulla stessa attività.

I due campi `creata_da` e `annullata_da` esistono perché l'amministratore può agire per conto di un partecipante (§15.9): senza di loro, fra un mese nessuno saprebbe dire se un'iscrizione l'ha tolta l'interessato o qualcun altro. Non sono mai mostrati al partecipante, che vede solo la propria iscrizione e il proprio stato.

#### 15.3.4 abilitazioni

`id`, `utente_id`, `edizione_id`, `attivata_il`, `origine` (`CODICE` / `MANUALE`), `attiva`, `revocata_il`, `revocata_da`.

È la vera autorizzazione. Il codice serve solo a crearla.

#### 15.3.5 codici_invito

`id`, `edizione_id`, `progressivo`, `impronta`, `creato_il`, `usato_il`, `utente_id`, `revocato`.

**Si conserva soltanto l'impronta irreversibile del codice, mai il codice in chiaro** — stessa tecnica già in uso per i limiti di frequenza di §6.1, stesso parametro `CHIAVE_IMPRONTE_ACCESSO`. Chi legge il database non può ricavare i codici non ancora usati.

Conseguenza operativa: i codici si vedono **una volta sola**, al momento in cui vengono generati, nella schermata di stampa. Chi li perde non li recupera: se ne generano di nuovi.

**`progressivo`** è un numero unico dentro l'edizione — 1, 2, 3… — stampato piccolo in un angolo del cartoncino. Serve a una cosa sola, ma indispensabile: senza, il pannello mostra quarantacinque righe identiche e indistinguibili, e alla richiesta *"ho perso il codice"* nessuno sa quale riga revocare.

Con il numero, l'operazione diventa possibile. Chi consegna i cartoncini annota **su carta**, insieme alle chiavi, che il 12 è andato a Mario; il pannello elenca *"Cartoncino 12 — non ancora usato"*, *"Cartoncino 13 — usato il 21/09"*; rigenerare vuol dire revocare il 12 ed emettere il 46. **I numeri non si riusano mai**, nemmeno dopo una revoca: un numero riemesso renderebbe bugiardo il foglio di carta.

Sul cartoncino e nella tabella **non compaiono né nomi né indirizzi email**: l'abbinamento fra numero e persona vive sul foglio di chi consegna, che è dove deve stare. Per i codici già usati l'abbinamento c'è comunque, perché `utente_id` è scritto.

#### 15.3.6 tentativi_codice

`utente_id`, `tentato_il`.

Il limite di `MAX_TENTATIVI_CODICE_ORA` tentativi all'ora (§15.4) **non usa il meccanismo a impronte** di §6.1, e non deve. Le impronte di §6.1 esistono perché lì la persona non ha ancora un'identità: si sta chiedendo un link e l'unica cosa che il sistema conosce è un indirizzo email, che non si vuole conservare. Qui invece chi prova il codice ha già fatto l'accesso e ha un identificativo interno, che è già nel database: costruirci sopra un'impronta non proteggerebbe niente e renderebbe il conteggio illeggibile.

La tabella è piccola e volatile: le righe più vecchie di un'ora le cancella il giro notturno delle pulizie (§15.11). Non è leggibile né da `anon` né da `authenticated`.

### 15.4 Accesso riservato

**Un codice personale monouso per ogni residente** (D18), non un codice unico condiviso.

Un codice condiviso fa il giro dei messaggi in dieci minuti e non è revocabile senza chiudere fuori tutti. Un codice personale, una volta consumato, non serve più a nessuno: chi lo ricevesse per sbaglio si sente rispondere che è già stato utilizzato.

**Formato**: `SOANA-XXXX-XXX`, dove le X vengono da un alfabeto senza caratteri ambigui — niente `O` e zero, niente `I`, `1` e `L` insieme. Lo digiterà una persona su un telefono, al freddo, con poca luce. La verifica ignora maiuscole, minuscole e spazi.

**Il codice si inserisce dopo l'accesso normale, non al posto di esso, e una volta sola nella vita.** Il partecipante entra con il link email come chiunque altro (§6.1, invariato); poi, sulla pagina della disponibilità, trova il pulsante di §15.5; la prima volta che lo preme, `/abitanti` gli chiede il codice. Da quel momento è abilitato per tutta l'edizione e il codice non gli serve più: le volte successive lo stesso pulsante lo porta direttamente all'elenco delle attività.

**Il flusso di autenticazione non viene toccato in nessun punto.** È la parte più delicata dell'applicazione, è già in esercizio, e questo disegno è stato scelto — il 12/09/2026 — proprio per non doverlo modificare. L'alternativa esaminata e scartata era far viaggiare una destinazione dentro il link email, così che un QR su un cartoncino potesse portare direttamente a `/abitanti` dopo l'accesso: funzionava, ma per una comodità di un secondo chiedeva di mettere le mani nella posta di autenticazione, nei due modelli di email e nella pagina di primo accesso. Il pulsante fa lo stesso lavoro senza toccare niente.

Regole:

- All'uso, il codice è consumato: `usato_il` e `utente_id` vengono scritti, e nasce l'abilitazione. Un secondo tentativo con lo stesso codice viene rifiutato con *"Questo codice è già stato utilizzato. Se pensi sia un errore, scrivi a [indirizzo]."*
- Massimo `MAX_TENTATIVI_CODICE_ORA` tentativi per utente all'ora, contati nella tabella di §15.3.6.
- Il messaggio di rifiuto è **identico** per codice inesistente, già usato o revocato, tranne nel caso di codice già usato **dallo stesso utente** che sta tentando, dove si dice semplicemente che è già abilitato.
- Un codice appartiene a un'edizione: quelli dell'edizione precedente non funzionano.
- **I partecipanti alla residenza sono maggiorenni.** Non è una condizione che il
  software verifica — non conosce l'età di nessuno (D24) — ma una caratteristica
  di chi riceve un cartoncino: i codici li consegna l'associazione, a mano,
  all'arrivo. Vale la pena scriverlo perché §15.8 fa arrivare una persona a casa
  di un'altra con nome, telefono e indirizzo, e l'informativa dei partecipanti
  lo dice.

**Tre vie d'uscita nel pannello**, che con 45 persone serviranno di sicuro:

- **Rigenerare** un codice per chi l'ha perso: si revoca il cartoncino con quel `progressivo` (§15.3.5) e se ne emette uno nuovo, con un numero nuovo.
- **Generare un codice singolo** per chi arriva in ritardo o per il quarto membro di una famiglia che ne ha ricevuto uno solo. L'amministratore lo legge a schermo e glielo passa come preferisce.
- **Abilitare direttamente un utente già registrato** (`origine` = `MANUALE`), scegliendolo fra gli utenti nel pannello. Serve a chi si è registrato con un indirizzo diverso da quello dato a VIHTA, o a chi ha perso il cartoncino ed è già entrato nell'app.

Si noti che non esiste, e non deve esistere, un *"abilita questo indirizzo email"* per una persona che non è ancora mai entrata. La riga di un utente nasce solo al primo accesso, per scelta e con un test che lo garantisce (§6.1): abilitare un indirizzo richiederebbe una seconda tabella dove conservare email di persone che utenti non sono — un secondo posto da proteggere, da cancellare e da dichiarare nell'informativa, per un caso che si risolve generando un codice in tre secondi.

E una **revoca puntuale**: disattivare una singola abilitazione senza toccare le altre. Revocare non cancella le iscrizioni già fatte: le rende solo non modificabili dall'interessato. Se vanno annullate, lo fa l'amministratore, che avvisa.

### 15.5 Ingresso al servizio

**Un solo ingresso dentro l'applicazione**, nessuna voce di navigazione (D19).

**In cima alla pagina della disponibilità**, sopra il pulsante di «Chi c'è in Valle», a chi ha fatto l'accesso: un **pulsante in Stile 1** con scritto *"Prenota un abitante"*, che porta a `/abitanti`.

**Solo il pulsante.** Nessuna nota, nessuna riga di spiegazione, né sopra né sotto, e identico per tutti: per chi è già abilitato e per chi deve ancora inserire il codice. Una prima stesura gli metteva accanto la domanda *"Sei un partecipante di VIHTA?"*; è stata tolta il 12/09/2026. Chi partecipa a VIHTA ha in mano un cartoncino e non ha bisogno che gli si chieda se è lui; a chiunque altro la nota spiegherebbe qualcosa che non può usare, aggiungendo due righe di testo in cima alla pagina più usata dell'applicazione. Il nome del pulsante dice già cos'è, e la spiegazione vera sta dietro al pulsante, su `/abitanti` (§15.6).

Questo pulsante è tutto il meccanismo di ingresso. La prima volta che lo si preme, `/abitanti` chiede il codice; da lì in avanti porta direttamente all'elenco delle attività.

**Perché in cima e non in fondo.** In una prima stesura questa era una riga discreta sotto la griglia, per non competere con l'azione principale della pagina. Il 12/09/2026 la scelta è stata rovesciata: da telefono la griglia è lunga, e quello che sta in coda non lo legge nessuno — è la stessa ragione per cui il collegamento a «Chi c'è in Valle» sta sopra la griglia e non sotto (§6.2). Un ingresso che non si vede è un ingresso che non esiste, e questo modulo ha 29 giorni di vita per farsi trovare.

La competizione con il "Prenota" delle celle si governa con il registro, non con la posizione: il pulsante di «Chi c'è in Valle» è in Stile 2, riempito di `verde`, perché riguarda tutti; questo è in **Stile 1**, perché riguarda 45 persone su un'edizione sola.

**Compare soltanto a chi ha fatto l'accesso e soltanto mentre un'edizione è attiva** (§15.3.1). Un visitatore non registrato non lo vede: non gli servirebbe, perché il codice si inserisce da utenti. Il 18 ottobre sparisce da sé — nessuno deve ricordarsi di toglierlo — e l'anno prossimo ricompare cambiando due date dal pannello.

**Il cartoncino all'arrivo resta, ma non è più l'unica via.**

Insieme alle chiavi, ogni partecipante riceve un cartoncino con il proprio codice in caratteri grandi, il numero di §15.3.5 piccolo in un angolo, e un **QR verso `wildworking.sassifraga.org/abitanti`**.

Il QR non ha bisogno di magie: chi lo inquadra senza aver fatto l'accesso viene mandato alla pagina di accesso, entra con l'email, e si ritrova sulla disponibilità — dove il pulsante è in cima, dove non può non vederlo. È proprio questa la ragione per cui il pulsante rende superfluo far viaggiare una destinazione dentro il link email (§15.4).

L'indirizzo va comunque tenuto corto e memorizzabile — `/abitanti` — perché qualcuno lo digiterà a mano.

**Non si aggiunge nessun rimando alla pagina «Chi c'è in Valle».** Quella pagina ha un solo collegamento per disciplina (D15), vive condivisa su Instagram davanti a un pubblico che con VIHTA non c'entra, e le regole di quel tipo si incrinano sempre una eccezione ragionevole alla volta.

### 15.6 Le schermate

**`/abitanti` — elenco.** Le attività `PUBBLICATA` dell'edizione attiva, in ordine cronologico, raggruppate per settimana. Per ciascuna, i soli dati di **livello 1**: titolo, nome di battesimo del proponente, giorno e ora, `luogo_generico`, posti rimasti o "completa". Con 25 voci si scorre tutto in un pollice. I giorni senza attività non compaiono.

Le attività già passate scompaiono dall'elenco il giorno successivo.

**`/abitanti/[id]` — dettaglio.** La stessa intestazione dell'elenco, più la **descrizione scritta dall'abitante** per esteso, cosa portare, lingua, e l'elenco di chi si è già iscritto **con i nomi pubblici di chi ha dato il consenso**, più il conteggio degli altri. Riusa esattamente il consenso `NOME_PUBBLICO` di §5.5 e la formula di §6.6 — nessun consenso nuovo, nessun testo nuovo da inventare.

**I dati di livello 2 compaiono solo dopo l'iscrizione**, in un riquadro che prima non c'era: cognome del proponente, telefono, indirizzo esatto, con la nota *"Il numero serve per avvisare Maria se hai un imprevisto il giorno stesso. Non usarlo per altro."* Gli stessi dati arrivano anche nell'email di conferma (§15.10).

**L'invito al nome pubblico sta qui**, accanto al pulsante che iscrive, e da nessun'altra parte:

> *Se vuoi che chi ti ospita sappia come ti chiami, puoi attivare il nome pubblico.*

con il collegamento alle impostazioni. Sta su questa pagina e non al primo passaggio dopo la registrazione perché la registrazione è comune a tutti, e i partecipanti VIHTA sono una minoranza degli utenti dell'app: una frase su chi ti ospita, mostrata a chi vuole solo prenotare una scrivania a Ronco, non vorrebbe dire niente.

Non è bloccante e non si ripete: chi non lo attiva si iscrive lo stesso, e comparirà nel conteggio senza nome (§15.9). La regola 17 vale qui come ovunque — il consenso che si ottiene come condizione per un servizio non è un consenso.

**`/abitanti` per chi non è ancora abilitato — il codice.** Non c'è una pagina separata: è **lo stesso indirizzo**, che mostra una cosa diversa a seconda di chi guarda. A chi non ha ancora l'abilitazione spiega in tre righe cos'è il servizio, dice che è riservato ai partecipanti VIHTA, e offre il campo del codice. Chi non ce l'ha legge a chi scrivere.

Un indirizzo solo, e non due, perché il pulsante di §15.5 è uno solo e non può sapere in anticipo chi lo premerà. Una volta inserito il codice, la stessa pagina diventa l'elenco: non c'è nessun passaggio in più, nessun secondo indirizzo da ricordare, e nessuna pagina che resta lì a fare da porta dopo che la porta è stata aperta.

Questa versione della pagina **esiste anche per chi non è abilitato**: non risponde "pagina non trovata". Una pagina che non c'è genera richieste di assistenza; una che spiega, no. Ma non mostra **nulla** delle attività — nemmeno i soli titoli, che contengono i nomi degli abitanti — e non lascia capire se un'email è già registrata o abilitata, per la stessa ragione di §6.1.

**`/le-mie-prenotazioni` — modificata.** Diventa una sola pagina con due sezioni, postazioni e attività. La sezione attività compare solo a chi è abilitato. Sarebbe un errore fare due elenchi separati: il residente ha una settimana sola da organizzare, non due agende.

### 15.7 Iscriversi e annullare

**Iscrizione** immediata e automatica, come per le postazioni (D3). Nessuna approvazione. Serve un'abilitazione attiva.

**Annullamento** sempre possibile fino all'inizio dell'attività. Oltre `ORE_DISDETTA` ore dall'inizio il pulsante resta, ma accompagnato da una frase che dice le cose come stanno: *"Mancano meno di 24 ore: chi ti aspetta si sta già preparando. Annulla solo se non puoi proprio venire."* Nessuna penale, nessun punteggio, nessun blocco: sono vicini di casa, non clienti.

**Nessuna lista d'attesa** (D22). Ad attività completa il pulsante non c'è: al suo posto la parola **"Completa"**, e una riga che dice cosa fare:

> *I posti sono esauriti. Se si libera un posto lo saprai dagli altri partecipanti: per entrare al posto di chi rinuncia, scrivi a [indirizzo].*

Una lista d'attesa con promozione automatica era stata proposta, ed è stata scartata il 12/09/2026. Le ragioni, per iscritto, perché è la funzione che verrà chiesta per prima:

- **Costa quanto un'intera sezione del modulo.** Il posto va riassegnato dentro la stessa operazione che lo libera, altrimenti fra l'annullamento e la promozione si infila chiunque stia guardando la pagina; e l'email di promozione non può partire dentro quella stessa operazione, quindi serve un secondo meccanismo che la recuperi se non parte. Sono due difficoltà vere, e l'edizione 2026 apre fra pochi giorni.
- **Esiste già un canale più veloce.** I partecipanti si parlano fra loro in un proprio gruppo di messaggi, fuori da questa applicazione. Chi rinuncia lo dice lì e trova un sostituto in minuti, cosa che nessuna coda automatica sa fare.
- **Sono 45 persone e 25 attività.** L'amministratore che sistema tre o quattro scambi a mano in un mese impiega meno tempo di quanto ne serva a leggere questo paragrafo.

L'amministratore chiude il giro dal pannello: **annulla l'iscrizione di chi rinuncia e iscrive chi subentra** (§15.9). Entrambe le persone ricevono un'email.

**Nessun limite** al numero di iscrizioni attive per persona (`MAX_ISCRIZIONI_ATTIVE`), coerente con D7. Con 25 attività in 29 giorni l'accaparramento è improbabile; il parametro esiste e si attiva cambiando un numero.

### 15.8 Gli abitanti che propongono

**È il punto più delicato dell'intero modulo, e non è tecnico.**

Gli abitanti che offrono le attività sono persone reali che **non sono utenti della piattaforma**. Molti sono anziani e non hanno dimestichezza digitale: non si registrano, non firmano niente online, non hanno un account da cui revocare un consenso. Il loro nome, cognome, numero di telefono e indirizzo di casa vengono comunque mostrati a dei residenti temporanei. È trattamento di dati personali di un terzo, e senza un consenso raccolto da qualche parte non ha base giuridica.

#### Il consenso si raccoglie fuori dall'app, e in app si dichiara

Il Direttivo raccoglie **il consenso firmato**, di persona, insieme all'offerta dell'attività. Nel software non esiste nessun modulo che l'abitante compili: sarebbe inutile per chi non lo userebbe mai, e finto per tutti gli altri.

Le forme ammesse sono **due sole**, ed è l'elenco chiuso del campo `consenso_modalita` (§15.3.2):

- **Modulo cartaceo firmato** a mano. È il caso normale.
- **Email di consenso** ricevuta da un indirizzo dell'abitante e conservata. Vale per chi la posta la usa: l'indirizzo è suo, il testo è suo, si archivia.

**Non è ammesso l'accordo verbale**, nemmeno se messo a verbale in una riunione del Direttivo. Un verbale prova che *voi* avete detto qualcosa, non che *Maria* abbia acconsentito; e siccome tutto §15.8 si regge sulla frase "il valore legale sta nella carta", ammettere il verbale la smonterebbe dall'interno. Se per un abitante non c'è modo di avere né la firma né l'email, **quell'attività non si pubblica**: si organizza fuori dall'applicazione, con un passaparola, come si faceva prima che esistesse questo software. È una rinuncia piccola e onesta; pubblicare il numero di telefono di una persona anziana sulla base di un ricordo di riunione non lo è.

Quello che il software fa è **registrare l'assunzione di responsabilità di chi pubblica**. Al momento di pubblicare un'attività, l'amministratore mette una spunta e sceglie quale delle due forme:

> ☐ Ho raccolto e conservo il consenso di questa persona, firmato su carta o ricevuto per email da un suo indirizzo. È stata informata di quali suoi dati verranno mostrati e a chi.
>
> ○ Modulo cartaceo firmato  ○ Email di consenso

Alla spunta il sistema scrive da sé **quando** è stata messa e **quale amministratore** l'ha messa. Non è burocrazia: fra un anno, senza quei due dati, nessuno saprà dire se Maria aveva detto di sì, né a chi chiedere.

**Senza la spunta l'attività non si pubblica.** È l'unico vincolo di questo tipo nel modulo. Non è un promemoria che si può ignorare, perché l'omissione riguarda una persona che non ha modo di accorgersene: non ha un account, non riceve email dal sistema, non vedrà mai la propria scheda.

Va detto chiaramente: **la spunta non è il consenso**. Il consenso è il foglio firmato. La spunta è la dichiarazione, tracciata, che quel foglio esiste e che è in mano al Direttivo. Il valore legale sta nella carta; il software serve solo a non far partire niente prima che la carta ci sia.

#### I tre livelli di visibilità

| Livello | Cosa | Chi lo vede |
|---|---|---|
| **1 — elenco** | Nome di battesimo, titolo dell'attività, comune o frazione, descrizione scritta dall'abitante | Tutti gli abilitati all'edizione |
| **2 — dopo l'iscrizione** | Cognome, numero di telefono, indirizzo esatto | Solo chi si è iscritto a quella attività, e le email che lo riguardano |
| **3 — interno** | `abitante_note_interne` | Solo l'amministratore. Mai un residente, mai un'esportazione |

Il livello 2 non è un dettaglio di interfaccia: sono i dati con cui una persona si presenta a casa di un'altra. Ha senso che li abbia chi ci va davvero, non chi sta scorrendo l'elenco — e ha senso che siano pochi, perché con 25 attività l'alternativa sarebbe far circolare fra 45 persone i recapiti di venticinque abitanti della valle.

**L'informativa cartacea deve elencare esattamente questi tre livelli.** È ciò che rende il consenso informato: non basta "acconsento alla pubblicazione dei miei dati", serve che Maria sappia che il suo numero lo vedranno le otto persone iscritte e nessun altro.

#### Come i tre livelli si impongono nel database

Questo paragrafo è tecnico ed è qui perché senza di esso la regola verrebbe costruita nel modo sbagliato.

Il requisito è *"queste colonne, solo per le righe a cui sei iscritto"*. La banca dati sa limitare **quali righe** vede una persona, e sa limitare **quali colonne** vede un ruolo, ma non sa combinare le due cose in una regola sola. Non esiste quindi un modo di scrivere il livello 2 come permesso di colonna, e provarci porta a scoprirlo tardi.

La tabella `attivita` **non è raggiungibile da nessuno**. Sopra ci stanno tre finestre, e si passa sempre da quelle:

| Finestra | Cosa mostra | A chi |
|---|---|---|
| `attivita_elenco` | Livello 1 | Chi ha un'abilitazione attiva. Solo attività `PUBBLICATA` dell'edizione attiva |
| `attivita_iscritto` | Livello 1 + livello 2 | Solo le attività su cui **chi guarda** ha un'iscrizione `ATTIVA` |
| `attivita_amministrazione` | Tutto, note interne comprese | Solo amministratore |

Le scritture non passano dalla tabella ma da funzioni, come già accade per le prenotazioni.

Ne segue una conseguenza che va detta, perché l'interfaccia da sola non la lascerebbe intuire: **chi ha annullato la propria iscrizione perde il livello 2 nello stesso istante.** Telefono e indirizzo esatto smettono di essere raggiungibili appena l'iscrizione passa ad `ANNULLATA`. Restano nell'email di conferma che quella persona ha già ricevuto — quello non si può riprendere indietro, ed è giusto che sia così: serviva ad avvisare Maria.

#### La descrizione la scrive l'abitante

Il campo `descrizione` contiene le parole del proponente — chi è, cosa propone, perché — non un testo redazionale dell'associazione. L'amministratore lo trascrive o lo incolla così com'è.

Questo ha una conseguenza pratica: **è testo di una persona, pubblicato a 45 persone, e nessun filtro automatico può controllarlo.** Può contenere un numero di telefono, l'indirizzo di casa, il nome di un nipote. L'amministratore lo rilegge prima di pubblicare, e il pannello glielo ricorda (§15.9).

#### Se un abitante cambia idea

Non ha un account da cui revocare: lo dirà a voce, a qualcuno del Direttivo. L'amministratore riporta l'attività in `BOZZA` e sparisce dall'elenco. Gli iscritti restano e vanno avvisati a mano: il sistema segnala che ci sono, non decide al posto di nessuno (§15.12).

### 15.9 Nel pannello

Una sezione "Attività", visibile all'amministratore soltanto.

- **Edizioni**: creare, attivare, disattivare. Una sola attiva per volta.
- **Attività**: creare, modificare, pubblicare, annullare. Il modulo di inserimento va disegnato per la velocità: 25 attività si caricano a mano, spesso in una sera sola, copiando da email e fogli. I campi sono raggruppati per **livello di visibilità** (§15.8), con l'etichetta di chi vedrà cosa scritta accanto a ciascun gruppo: chi inserisce i dati di una persona deve sapere, mentre li scrive, dove finiranno.
- **Pubblicazione**: la schermata che porta un'attività da `BOZZA` a `PUBBLICATA` mostra un'anteprima di come la vedranno i residenti — prima il livello 1, poi il livello 2 — e sopra all'anteprima due cose: la **spunta del consenso** di §15.8, e il promemoria di rileggere la descrizione scritta dall'abitante, che può contenere dati che lui non si rendeva conto di dare. Senza la spunta il pulsante non si attiva.
- **Codici**: generarne un blocco per l'edizione, con una schermata di stampa adatta ai cartoncini, ciascuno con il proprio numero (§15.3.5). I codici si vedono **solo qui e solo una volta**. Generarne uno singolo, e rigenerare quello di un numero perso.
- **Abilitazioni**: elenco, abilitazione diretta di un utente già registrato, revoca puntuale (§15.4).
- **Iscritti per attività**: chi viene, con l'indirizzo email a cui scrivere per avvisare.
- **Iscrivere e annullare per conto di un partecipante**: le due azioni che sostituiscono la lista d'attesa (§15.7).

#### L'elenco degli iscritti, e cosa si passa al proponente

Serve una regola esplicita, perché è un'eccezione apparente a §4: **Maria ha bisogno di sapere quante persone arrivano a casa sua**, e l'amministratore ha bisogno di poterle scrivere se qualcosa cambia.

L'elenco è visibile all'amministratore **fino al giorno successivo all'attività**, e porta l'**indirizzo email** di ciascun iscritto — è il solo recapito che l'applicazione conosce, ed è lì per scrivere, non per farne altro. Dopo quel giorno l'iscrizione rientra nella regola ordinaria dei 30 giorni e si anonimizza come tutto il resto.

**Quello che si passa al proponente è un'altra cosa, e non contiene email.** L'applicazione non conosce il nome e il cognome dei partecipanti: conosce l'email, e conosce il `nome_pubblico` di chi ha scelto di averne uno. Quindi ciò che l'esportazione produce è, con la stessa formula di §6.6:

> *Sabato vengono in otto. Tre hanno lasciato il nome: Luca, Anna, Fabio.*

Se serve dare a Maria i nomi veri di tutti e otto, **lo si fa fuori dall'applicazione**: l'associazione ha l'elenco dei partecipanti VIHTA con i loro nomi e i loro indirizzi email, raccolto per la residenza e non da questo software, e l'abbinamento si fa lì. È un trattamento dell'associazione, separato e indipendente da questo strumento, esattamente come il registro presenze cartaceo dei Comuni di D10.

**Non si aggiunge un campo "nome" al profilo per risolvere questa cosa.** Sarebbe un sesto dato personale obbligatorio di fatto — chi lo lascia vuoto si sente scortese — e romperebbe la regola 1, che è il cardine di tutto l'impianto di §7. La frase che invita ad attivare il nome pubblico sta sulla pagina dell'attività (§15.6), è facoltativa, e basta così.

#### Iscrivere e annullare per conto di qualcuno

Sono due poteri che l'amministratore non ha sulle **prenotazioni** delle postazioni, e che ha invece sulle **iscrizioni** alle attività. La differenza non è una svista: senza lista d'attesa, lo scambio di un posto fra chi rinuncia e chi subentra può chiuderlo solo una persona (D22, §15.7).

Restano dentro la regola 6, che vieta gli annullamenti **automatici**, non quelli decisi da qualcuno che si assume la responsabilità. Le condizioni sono tre:

- **Valgono solo per le iscrizioni.** Nessuna di queste due azioni tocca mai una `prenotazione`: lì resta la regola di §8.2, cioè un elenco da guardare e nessun bottone che annulli.
- **Sono tracciate.** `creata_da` e `annullata_da` (§15.3.3) dicono per sempre chi ha agito, e quando.
- **La persona lo viene a sapere.** Entrambe le azioni mandano un'email all'interessato, che dice cos'è successo e chi contattare. Un posto che sparisce senza spiegazione è peggio di un posto perso.

### 15.10 Email del modulo

Tutte dal mittente di D12, tutte in italiano, tutte con la stessa voce di §13.9.

| Quando | Contenuto |
|---|---|
| Iscrizione confermata | Attività, giorno, ora, i dati di **livello 2** (cognome, telefono, indirizzo esatto), cosa portare, link per annullare |
| Annullamento | Conferma sobria, nessun rimprovero |
| Iscrizione fatta dall'amministratore | Come la conferma, più la riga che dice chi l'ha iscritta e a chi scrivere se è un errore (§15.9) |
| Annullamento fatto dall'amministratore | Cosa è successo, il motivo se c'è, e a chi scrivere (§15.9) |
| Promemoria la sera prima | Si appoggia al giro notturno già esistente (§6.3): stessa esecuzione, un elenco in più |
| Attività annullata | Motivo se c'è, e l'invito a guardare le altre |

Il promemoria delle attività **non è un secondo giro notturno**: si aggiunge a quello che parte già alle `ORA_PROMEMORIA`. Una sola esecuzione, due elenchi.

Attenzione al tetto giornaliero del fornitore di posta: 45 partecipanti e 25 attività possono generare, nei primi giorni dell'edizione, più email di quante ne generi il coworking in una settimana. Da verificare prima dell'apertura delle iscrizioni. Senza lista d'attesa il rischio è più basso di quanto fosse nella prima stesura, ma non è nullo: il giorno in cui il programma viene annunciato, 45 persone si iscrivono a tre attività ciascuna.

### 15.11 Dati personali del modulo

Si aggiungono alla tabella di §7.

| Dato | Obbligatorio | Perché | Base giuridica | Chi lo vede | Per quanto |
|---|---|---|---|---|---|
| Iscrizioni | Sì | Erogare il servizio | Art. 6.1.b | L'utente; l'amministratore fino al giorno dopo l'attività | 30 giorni dalla data dell'attività, poi anonimizzate |
| Abilitazione | Sì | Riservare il servizio ai partecipanti VIHTA | Art. 6.1.b | L'utente, l'amministratore | Fino a 30 giorni dopo la chiusura dell'edizione |
| Impronta del codice | Sì | Impedire il riuso del biglietto | Art. 6.1.b | Nessuno: la legge solo il sistema | Fino a 30 giorni dopo la chiusura dell'edizione |
| Dati dell'abitante, livello 1 — nome, comune, descrizione | — | Far sapere ai partecipanti chi propone, dove e cosa | Art. 6.1.a — **consenso firmato su carta o ricevuto per email**, raccolto fuori dall'app (§15.8) | Tutti gli abilitati all'edizione | Fino alla chiusura dell'edizione |
| Dati dell'abitante, livello 2 — cognome, telefono, indirizzo esatto | — | Permettere a chi partecipa di arrivare e di avvisare in caso di imprevisto | Art. 6.1.a — **stesso consenso**, stesso foglio o stessa email | Solo chi ha un'iscrizione `ATTIVA` su quella attività | Fino alla chiusura dell'edizione |
| Note interne sull'abitante | — | Organizzare l'attività con il proponente | Art. 6.1.b | Solo amministratore | Fino alla chiusura dell'edizione |
| Dichiarazione di consenso raccolto | Sì | Dimostrare che il consenso firmato esiste e sapere chi l'ha raccolto | Art. 6.1.c — obbligo di rendicontazione (art. 5.2 GDPR) | Solo amministratore | Come l'attività |
| **Nome pubblico di chi si iscrive, comunicato al proponente** | — | Far sapere a chi ospita chi arriverà a casa sua | Art. 6.1.b, ed è **comunicazione a un terzo**: il proponente non è un incaricato dell'associazione | Gli altri iscritti alla stessa attività, e il proponente | Fino al giorno successivo all'attività |
| Tentativi di inserimento del codice | Sì | Impedire che un codice si indovini per tentativi | Art. 6.1.f — interesse legittimo alla sicurezza | Nessuno: li legge solo il sistema | Un'ora |

La riga sul nome pubblico va detta anche **nell'informativa dei partecipanti**, non solo qui: comunicare a Maria che sabato viene Luca è una comunicazione di un dato personale a una persona che non fa parte dell'associazione, e chi attiva il nome pubblico deve saperlo prima, non dopo. Chi non lo attiva compare nel solo conteggio (§15.9).

**Pulizie aggiuntive**, che si agganciano al giro di `ORA_PULIZIE` già esistente:

| Cosa | Quando |
|---|---|
| Iscrizioni con data attività oltre `GIORNI_ANONIMIZZAZIONE` | Anonimizzate, con la copia `stat_` di §5.3 e le sue eccezioni |
| Abilitazioni e impronte dei codici di un'edizione chiusa da `GIORNI_CHIUSURA_EDIZIONE` | Cancellate |
| Tentativi di inserimento del codice più vecchi di un'ora | Cancellati |
| Dati degli abitanti di un'edizione chiusa — tutti e tre i livelli, **titolo e descrizione compresi** | Cancellati. Restano `data`, `capienza` e il numero di iscritti, che è tutto ciò che serve per dire "nel 2026 abbiamo fatto 23 attività, 180 partecipazioni, in media 8 a serata". La dichiarazione di consenso (chi, quando, in che forma) resta finché resta l'attività: è la prova di aver fatto le cose per bene |

**Si cancella anche il titolo**, e vale la pena dire perché, visto che sembra un dato innocuo. §15.6 stabilisce che nemmeno i titoli si mostrano a chi non è abilitato, e la ragione è che *i titoli contengono i nomi degli abitanti* — "Cena da Maria", "Il forno di Giulio". Tenere il titolo dopo aver cancellato il cognome non cancellerebbe granché. L'alternativa esaminata era imporre titoli senza nomi di persona, ma è una consegna che si dimentica alla terza sera di caricamento, ed è il genere di regola che nessun test può far rispettare.

L'informativa privacy va aggiornata di conseguenza: è una versione datata, non una riscrittura.

### 15.12 Casi limite

| Situazione | Comportamento |
|---|---|
| Due persone prendono l'ultimo posto insieme | Risolto dal vincolo di unicità del database, come §8.1. Alla seconda l'attività risulta "completa", con la riga di §15.7 che dice cosa fare |
| Capienza abbassata sotto il numero di iscritti | Nessun annullamento automatico. Compare nell'elenco "Prenotazioni da controllare" del pannello (§6.7), che accoglie anche le iscrizioni |
| Attività annullata con iscritti | L'amministratore conferma; tutti gli iscritti ricevono l'email; le iscrizioni passano ad `ANNULLATA` |
| Abitante che ritira il consenso | Lo dice a voce a qualcuno del Direttivo: non ha un account. L'amministratore toglie la spunta, l'attività torna in `BOZZA` e sparisce. Gli iscritti restano e vanno avvisati a mano: il sistema lo segnala, non decide |
| Edizione disattivata con iscrizioni future | Le iscrizioni restano valide e visibili al loro titolare. Il modulo sparisce dall'ingresso, non dalle iscrizioni già fatte |
| Partecipante non abilitato che apre un link diretto a un'attività | Viene portato a `/abitanti`, che gli chiede il codice (§15.6). Non vede titolo, abitante né luogo |
| Abilitazione revocata con iscrizioni attive | Le iscrizioni restano ma non sono più modificabili dall'interessato. Le annulla l'amministratore, avvisando (§15.9) |
| Utente che cancella l'account | Iscrizioni future annullate e posti liberati; iscrizioni passate anonimizzate **senza copiare** i campi `stat_`, come §5.3; abilitazione, codice e tentativi cancellati |
| Attività completa | Nessuna lista d'attesa (D22). L'attività dice "Completa" e la riga di §15.7 indirizza a chi scrivere. Lo scambio lo chiude l'amministratore (§15.9) |
| Amministratore che annulla l'iscrizione di un altro | Permesso, solo sulle iscrizioni e mai sulle prenotazioni. Tracciato in `annullata_da`, e l'interessato riceve un'email (§15.9) |
| Amministratore che iscrive un altro a un'attività completa | Rifiutato: il vincolo di capienza vale anche per lui. Prima si annulla l'iscrizione di chi rinuncia, poi si crea quella di chi subentra |
| Attività senza la spunta del consenso | Non pubblicabile. Il sistema rifiuta il passaggio a `PUBBLICATA`, e il rifiuto è imposto dal database, non solo dal modulo |
| Spunta del consenso senza la forma indicata | Rifiutata: `consenso_modalita` è obbligatorio quando la spunta è messa, e ammette due soli valori (§15.3.2, §15.8) |
| Spunta del consenso tolta su un'attività già pubblicata | L'attività torna in `BOZZA` e sparisce dall'elenco. Gli iscritti restano e vanno avvisati a mano |
| Partecipante abilitato ma non iscritto che tenta di leggere i dati di livello 2 | Rifiutato dal database, non solo nascosto dall'interfaccia: nessun cognome, telefono o indirizzo esatto esce verso chi non è iscritto a quella attività |
| Partecipante che annulla e poi riapre la pagina | Perde il livello 2 nello stesso istante dell'annullamento (§15.8). Resta solo nell'email che ha già ricevuto |
| Data dell'attività fuori dall'edizione | Rifiutata in scrittura |
| Due edizioni attive | Impossibile: attivarne una disattiva l'altra, con avviso |

### 15.13 Parametri del modulo

Si aggiungono a quelli di §10, nello stesso file.

| Parametro | Valore iniziale |
|---|---|
| `ORE_DISDETTA` — ore prima dell'attività oltre cui l'annullamento mostra l'avviso | **24** |
| `MAX_TENTATIVI_CODICE_ORA` — tentativi di inserimento codice per utente all'ora | **5** |
| `MAX_ISCRIZIONI_ATTIVE` — iscrizioni attive per persona | **nessun limite** |
| `PREFISSO_CODICE` — prima parte del codice d'invito | `SOANA` |
| `EMAIL_ASSISTENZA_ABITANTI` — indirizzo mostrato a chi non riesce ad accedere | da definire, casella del Direttivo |
| `GIORNI_CHIUSURA_EDIZIONE` — giorni dopo la fine dell'edizione per cancellare abilitazioni e codici | **30** |

### 15.14 Ordine di costruzione del modulo

Prosegue la numerazione di §12. **Sette passi, uno per sessione di lavoro**, ciascuno concluso solo quando funziona, è salvato nel controllo di versione, e i test passano — la stessa regola di §12.

L'ordine non è negoziabile nei primi due passi: le regole di accesso vengono prima di tutto ciò che le userà, altrimenti si costruiscono schermate sopra un permesso che non c'è ancora e ci si accorge solo alla fine che qualcosa esce da dove non doveva. Dal passo 16 in poi c'è più libertà, ma il 20 va per ultimo perché è il solo che tocchi pagine già in mano alle persone.

I passi **14 e 15 possono entrare nel rilascio di Wild Working anche da soli**: nascono vuoti e irraggiungibili — nessuna edizione attiva, nessun pulsante da nessuna parte — ma i test delle regole di accesso li coprono dal primo giorno e l'informativa privacy si scrive completa una volta sola invece che due.

---

**Passo 14 — Le tabelle e le regole di accesso**

Le sei tabelle di §15.3 e le tre viste di §15.8, con le loro politiche. Nient'altro: nessuna schermata, nessuna azione, nessuna email.

Riferimenti: §15.3 per intero, §15.8 «Come i tre livelli si impongono nel database», §15.12.
Test nuovi: `abilitazioni`, `livelli-abitante`, `attivita-consenso`, `edizione`, `iscrizioni`.
Cosa può rompersi: niente di esistente. È il passo più sicuro e il più importante.
Alla fine: `npm run test:rls` passa e il database rifiuta tutto ciò che §15.12 dice debba rifiutare.

**Passo 15 — Edizioni, codici, abilitazioni**

Il pannello delle edizioni (creare, attivare, disattivare, una sola per volta). La generazione di un blocco di codici con la schermata di stampa numerata, e quella di un codice singolo. Il consumo del codice su `/abitanti`, nella sua versione «inserisci il codice». L'abilitazione diretta di un utente già registrato e la revoca puntuale.

Riferimenti: §15.3.1, §15.3.4, §15.3.5, §15.3.6, §15.4, §15.6 («`/abitanti` per chi non è ancora abilitato»).
Test nuovi: `codici`.
Cosa può rompersi: niente di esistente. `/abitanti` esiste ma non porta ancora da nessuna parte.
Alla fine: si può generare un cartoncino, inserirne il codice, e diventare abilitati — anche se non c'è ancora niente da vedere.

**Passo 16 — Il pannello delle attività**

Creare, modificare, pubblicare, annullare un'attività. Il modulo di inserimento raggruppato per livello di visibilità. La schermata di pubblicazione con anteprima, spunta del consenso e promemoria di rilettura della descrizione.

Riferimenti: §15.3.2, §15.8 per intero, §15.9 (primi tre punti).
Test: si estende `attivita-consenso` con il percorso dal pannello.
Cosa può rompersi: il pannello esistente, se la nuova sezione ne cambia la struttura. Va aggiunta accanto alle altre, non dentro.
Alla fine: si possono caricare le 25 attività vere. **Da qui in poi si può cominciare a raccogliere i consensi cartacei e a inserire, anche mentre si costruisce il resto.**

**Passo 17 — Elenco, dettaglio, iscrizione**

`/abitanti` nella sua versione «elenco» per chi è abilitato, e `/abitanti/[id]`. Iscriversi, annullare, i due livelli di visibilità in pagina, l'invito al nome pubblico, il caso «Completa».

Riferimenti: §15.6, §15.7, §15.2.
Test: si estende `iscrizioni` con il percorso dalle pagine.
Cosa può rompersi: niente di esistente.
Alla fine: **il servizio funziona.** Se i giorni dovessero finire qui, si può aprire l'edizione — con le email ancora mancanti e gli scambi di posto gestiti a voce.

**Passo 18 — Iscrivere e annullare per conto di qualcuno**

Le due azioni del pannello che sostituiscono la lista d'attesa, con la tracciatura in `creata_da` e `annullata_da`, e l'elenco degli iscritti per attività con la sua esportazione.

Riferimenti: §15.9 («L'elenco degli iscritti» e «Iscrivere e annullare per conto di qualcuno»), §15.7, D22.
Test nuovi: `iscrizioni-amministratore`.
Cosa può rompersi: la regola 6. Il test deve dimostrare che queste due azioni non toccano **nessuna** `prenotazione`.
Alla fine: l'amministratore chiude uno scambio di posto in mezzo minuto.

**Passo 19 — Le email del modulo**

Le cinque email di §15.10, e il promemoria della sera prima agganciato al giro notturno che già esiste — un elenco in più, non una seconda esecuzione.

Riferimenti: §15.10.
Test: si estende `promemoria`, che deve continuare a passare per le prenotazioni **e** coprire le attività.
Cosa può rompersi: il promemoria delle postazioni, che è già in esercizio. È il passo più delicato dopo il 20.
Alla fine: chi si iscrive riceve la conferma con l'indirizzo di casa di Maria, e la sera prima il promemoria.

**Passo 20 — Quello che tocca ciò che già gira**

Tutte insieme, perché sono le sole modifiche a parti già in mano alle persone, e conviene farle in un colpo solo con tutti i test davanti:

- L'ingresso di §15.5 in cima alla pagina della disponibilità.
- Le due sezioni di `/le-mie-prenotazioni`.
- Le iscrizioni nell'elenco «Prenotazioni da controllare» del pannello.
- Le tre pulizie notturne di §15.11.
- La cancellazione dell'account estesa alle iscrizioni, all'abilitazione e al codice.
- Il `sw.js`, che **non deve tenere offline nessuna pagina del modulo**: né l'elenco, né un dettaglio, né la pagina del codice.
- L'informativa privacy, versione nuova e datata.

Riferimenti: §15.1 (l'elenco delle sette cose), §6.2, §15.5, §15.6, §15.11, §15.12.
Test: si estendono `diritti`, `retention`, `installabilita`, `disponibilita`, `amministrazione`. **Nessuno di questi va indebolito**: se uno si rompe, è il codice nuovo a essere sbagliato.
Alla fine: il modulo è raggiungibile, e tutto ciò che riguarda il coworking continua a comportarsi esattamente come prima.

---

**Cose che non sono passi di software**, e che vanno avanti in parallelo perché nessuna sessione di lavoro le produce:

- L'**informativa cartacea per gli abitanti**, che deve elencare i tre livelli di §15.8.
- La raccolta dei consensi firmati, che può cominciare subito e non aspetta niente.
- La **stampa dei cartoncini**, che dipende dal passo 15 e va fatta prima del 20 settembre.
- La verifica del **tetto giornaliero di invii** del fornitore di posta (§15.10).
- L'elenco dei partecipanti VIHTA con nomi ed email, tenuto dall'associazione fuori dall'app, che serve a §15.9.

### 15.15 Fuori dall'MVP del modulo

- **Lista d'attesa con promozione automatica** (D22). È la funzione che verrà chiesta per prima, e le ragioni per cui non c'è sono scritte per esteso in §15.7. Se un giorno rientrerà, rientrerà con il proprio test: il posto riassegnato nella stessa operazione che lo libera, e l'email di promozione recuperata dal giro notturno se non parte al primo tentativo.
- Proposta delle attività da parte degli abitanti direttamente dall'app. Per questa edizione le raccoglie l'amministratore: 25 attività non giustificano un secondo flusso di registrazione per persone che vivono in valle e preferiscono il telefono.
- Valutazioni o commenti dopo l'attività.
- Calendario esportabile (ICS) delle proprie iscrizioni.
- Traduzione inglese dell'elenco.
- Statistiche del modulo: si accumulano da sole nei campi `stat_`, la schermata si fa quando serve, come per §6.8.
