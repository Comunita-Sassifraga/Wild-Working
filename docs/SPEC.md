# SPEC — Prenotazione postazioni coworking Valle Soana

**Progetto:** Comunità Sassifraga APS
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
| D11 | Indirizzo del servizio                    | Sottodominio **`prenota.sassifraga.org`**. Non una sottocartella di `www.sassifraga.org`: il sito è su Google Sites, che non permette di dirottare un percorso verso un'applicazione esterna. Vedi §14.                                    |
| D12 | Mittente delle email                      | Le email dell'app partono da un **sottodominio dedicato** (`noreply@coworking.sassifraga.org`), mai dal dominio principale. Protegge la consegna della posta istituzionale. Vedi §14.                                                        |
| D13 | Dati facoltativi                          | Cinque campi facoltativi (età, genere, professione, motivo della visita, residenza), raccolti su consenso separato e revocabile. Richiedibili anche in registrazione, ma mai bloccanti. Usati solo in forma aggregata (§6.8).               |
| D14 | Moderazione del nome pubblico             | Moderazione **successiva**: il nome è pubblico subito, l'amministratore viene avvisato e può azzerarlo. Filtro automatico in scrittura come prima difesa.                                                                                   |
| D15 | Divisione fra le due pagine pubbliche     | La griglia di disponibilità mostra **conteggi**: posti liberi su totale e numero di presenze pubbliche. I **nomi pubblici** compaiono soltanto nella pagina "Chi c'è in Valle". Ogni pagina rimanda all'altra con un collegamento e una nota. Vedi §6.2 e §6.6.                        |

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

---

## 4. Ruoli

| Ruolo                           | Può fare                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visitatore** (non registrato) | Vedere la disponibilità della finestra prenotabile (oggi + `FINESTRA_GIORNI`). Vedere la pagina pubblica "Chi c'è". Leggere l'informativa privacy.                                        |
| **Utente registrato**           | Tutto quanto sopra, più: prenotare, annullare le proprie prenotazioni, impostare il nome pubblico, modificare il proprio profilo, scaricare i propri dati, cancellare il proprio account. |
| **Referente di sede**           | Tutto quanto sopra, più: vedere l'elenco nominativo delle prenotazioni **della sola sede assegnata**, limitato alla **finestra prenotabile**. Segnalare una chiusura.                     |
| **Amministratore**              | Tutto. Gestire sedi, capienze, chiusure, referenti. Moderare i nomi pubblici (§6.5). Vedere le statistiche aggregate (§6.8), che non contengono né email né nomi pubblici. Cancellare un account su richiesta. |

**Regola di minimizzazione:** nessun ruolo, incluso l'amministratore, ha accesso a dati nominativi dopo che sono trascorsi 30 giorni dalla prenotazione. Restano solo dati aggregati e anonimi. Questo evita che lo strumento diventi un archivio degli spostamenti delle persone.

---

## 5. Struttura dei dati

Sette entità. Descritte prima a parole, poi in tabella.

- Un **utente** ha un'email e, se vuole, un nome pubblico.
- Una **sede** ha un nome, un indirizzo, una capienza e degli orari.
- Una **prenotazione** collega un utente a una sede, in una data, in una fascia.
- Una **chiusura** rende una sede non prenotabile in un certo periodo.
- Un **consenso** registra quando e per cosa un utente ha dato o revocato il permesso.
- Un **incarico** assegna il ruolo di referente a un utente per una sede.
- Un **periodo attività** indica in quali periodi dell'anno la sede è attiva.

Due archivi di supporto richiesti da §6.5 e §6.7 non sono ancora descritti qui: l'**elenco dei termini vietati** e il **registro delle moderazioni** (chi, quando, quale nome è stato rimosso). Vanno aggiunti a questa sezione quando si costruisce la moderazione (passi 6 e 8 di §12).

### 5.1 utenti

| Campo                  | Tipo                                                    | Obbligatorio | Note                                               |
| ---------------------- | ------------------------------------------------------- | ------------ | -------------------------------------------------- |
| `id`                   | identificativo interno                                  | sì           | Generato dal sistema                               |
| `email`                | testo                                                   | **sì**       | Unico dato personale obbligatorio                  |
| `nome_pubblico`        | testo, max 40 caratteri                                 | no           | Vuoto = non compare mai in pagine pubbliche        |
| `eta`                  | `18-25`, `26-35`, `36-50`, `51-65`, `Oltre 65`          | no           |                                                    |
| `genere`               | `M` / `F` / `Preferisco non rispondere`                 | no           |                                                    |
| `professione`          | testo, max 100 caratteri                                | no           |                                                    |
| `motivo_visita`        | testo, max 200 caratteri                                | no           |                                                    |
| `residenza`            | `Valle Soana`/`Canavese`/ `Piemonte` / `Italia`/`Altro` | no           |                                                    |
| `mostra_nome_pubblico` | sì/no                                                   | sì           | Default: **no**                                    |
| `lingua`               | `it` / `en` / `fr`                                      | sì           | Default `it`                                       |
| `creato_il`            | data e ora                                              | sì           |                                                    |
| `ultimo_accesso`       | data e ora                                              | sì           | Serve per la cancellazione degli account dormienti |

Non esiste un campo password: l'accesso avviene via link inviato per email (§6.1).

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
| `anonimizzata` | sì/no | Diventa sì dopo 30 giorni: il legame con l'utente viene reciso |
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

Il consenso `DATI_FACOLTATIVI` si considera revocato quando tutti e cinque i campi sono vuoti, qualunque sia la strada con cui sono stati svuotati (pulsante "Rimuovi" o modifica manuale): il registro segue lo stato reale dei dati, e le righe le scrive il database da solo a ogni cambiamento. Il registro sopravvive alla cancellazione dell'account (§7): le righe conservano l'identificativo interno dell'utente, che dopo la cancellazione non rimanda più a nessuno.

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

### 6.3 Prenotare

1. L'utente sceglie sede, giorno e fascia (o "giornata intera").
   Se sceglie la giornata intera e una delle due fasce è esaurita, non viene
   creata nessuna prenotazione: il sistema dice quale fascia è piena e propone
   di prenotare solo l'altra. Una richiesta di giornata intera non si
   accontenta di mezza giornata senza che la persona lo abbia scelto.
2. Il sistema verifica in tempo reale che ci sia ancora posto.
3. La prenotazione è confermata **immediatamente**, senza approvazioni.
4. Parte un'email di conferma con: sede, indirizzo, data, orario, link per annullare, allegato per il calendario.

Vincoli:
- Non si può prenotare nel passato.
- Non si può prenotare oltre **oggi + `FINESTRA_GIORNI` inclusi** (14 al lancio). Esempio con 14: sabato 15 agosto si può prenotare fino a sabato 29 agosto compreso; domenica 30 agosto è il primo giorno non prenotabile.
- Il calcolo di "oggi" avviene sempre nel fuso orario **Europe/Rome**, mai in orario universale (§8.4).
- Non si può avere più di una prenotazione attiva nella stessa data e fascia (nemmeno in sedi diverse). Il vincolo è imposto dal database, come quello di §8.1.
- Non si può prenotare una sede chiusa o disattivata.

### 6.4 Annullare

- Sempre possibile, fino all'orario di inizio della fascia.
- Un clic da **"Le mie prenotazioni"** — la pagina che elenca le proprie prenotazioni attive da oggi fino alla fine della finestra, con sede, giorno, fascia e orario — o dal link nell'email di conferma. Nessuna conferma richiesta oltre al clic. Le prenotazioni passate non compaiono: dopo 30 giorni vengono comunque anonimizzate (§7).
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

**Le impostazioni personali sono un elenco solo**, non tre sezioni: email, nome pubblico, dati facoltativi, lingua. Ogni voce ha la stessa intestazione, e quello che si può cambiare si cambia dove si legge — con il proprio pulsante di salvataggio accanto, e per i dati facoltativi anche quello di rimozione. Email e lingua sono in sola lettura. Chi apre questa pagina fa una domanda sola, *"cosa sapete di me"*, e deve trovare una risposta sola.

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
- Statistiche aggregate (§6.8).
- Cancellazione di un account su richiesta scritta dell'interessato.

### 6.8 Statistiche

Solo **aggregate e anonime**. Nessun dato riferibile a una persona.

- Prenotazioni per mese, per sede.
- Tasso di occupazione medio, per sede e per fascia.
- Persone distinte che hanno usato gli spazi in un mese (conteggio, senza elenco).
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
| Email                 | **Sì**       | Identificare chi ha prenotato, mandare conferme, permettere l'annullamento          | Art. 6.1.b — necessario a erogare il servizio richiesto | L'utente, il referente della sede prenotata (solo prossimi 14 giorni), l'amministratore | Finché l'account esiste                       |
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

### Conservazione e cancellazione automatica

| Cosa | Quando | Come |
|---|---|---|
| Prenotazioni oltre 30 giorni | Ogni notte | Si recide il legame con l'utente. Restano il conteggio, la sede e — se il consenso è attivo — i cinque valori facoltativi copiati nei campi `stat_` (§5.3), senza sapere di chi fossero. |
| Account senza accessi da 24 mesi | Ogni notte | Avviso via email a 23 mesi; cancellazione a 24. |
| Richieste di accesso mai completate | Ogni notte | Cancellate dopo 24 ore |
| Link di accesso | 15 minuti | Non più utilizzabili; non ne resta traccia |
| Impronte delle richieste di link (§6.1) | 1 ora | Cancellate. Sono hash con chiave, non indirizzi: nessuna email o indirizzo di rete viene conservato |
| Log tecnici | 30 giorni | Cancellati. Non devono contenere email in chiaro. |

### Diritti dell'interessato: dove si esercitano

| Diritto                                   | Come                                                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accesso (art. 15) e portabilità (art. 20) | Pulsante "Scarica i miei dati" → file JSON immediato                                                                                                        |
| Rettifica (art. 16)                       | L'utente modifica da solo nome pubblico, eta, genere, professione, motivo visita, residenza e lingua. Per l'email: cambio con verifica del nuovo indirizzo. |
| Cancellazione (art. 17)                   | Pulsante "Cancella il mio account" → conferma → esecuzione immediata, non richiesta a un umano                                                              |
| Revoca del consenso (art. 7.3)            | Due consensi indipendenti (§5.5). Nome pubblico: interruttore nelle impostazioni, effetto immediato e retroattivo. Dati facoltativi: pulsante "Rimuovi i miei dati facoltativi", che svuota tutti e cinque i campi. Entrambe le revoche sono immediate, non richiedono l'intervento di un umano e non incidono sulle prenotazioni |
| Opposizione, limitazione                  | Via email al titolare, indirizzo indicato nell'informativa                                                                                                  |

### Adempimenti fuori dal software

==Da fare comunque, non risolvibili con il codice:

1. **Informativa privacy** in italiano e inglese, linkata prima della registrazione.
2. **Voce nel registro dei trattamenti** dell'APS (art. 30). L'esonero per le organizzazioni piccole non si applica: il trattamento è sistematico, non occasionale.
3. **Accordi con i fornitori** (DPA) con Supabase, Vercel/Hetzner, Resend. Moduli standard, da accettare e archiviare.
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
| Utente cancella l'account con prenotazioni future | Le prenotazioni future vengono annullate e i posti liberati. Le prenotazioni passate vengono anonimizzate **senza copiare** i campi `stat_` (§5.3). |
| Doppio clic sul pulsante "prenota" | Una sola prenotazione (protezione contro l'invio ripetuto) |
| Link di accesso già usato | Messaggio chiaro e possibilità di richiederne un altro |
| Cambio di ora legale | Le fasce sono orari locali, non istanti assoluti |
| Sede senza connessione | La versione installata mostra l'ultima situazione scaricata, con la data dell'aggiornamento e l'avviso che potrebbe non essere aggiornata. Prenotare richiede connessione. |
| Prenotazione inviata a cavallo della mezzanotte | La finestra viene ricalcolata al momento della scrittura sul database, non al caricamento della pagina. Una richiesta partita alle 23:59 per il giorno appena uscito dalla finestra viene rifiutata con un messaggio chiaro. |
| Calcolo di "oggi" | Sempre in fuso `Europe/Rome`. Un server in orario universale considererebbe ancora "ieri" fino alle 02:00 italiane in ora legale, aprendo o chiudendo la finestra nel giorno sbagliato. |
| Periodo di attività accorciato con prenotazioni dentro | Nessuna cancellazione automatica. L'amministratore vede l'elenco delle prenotazioni rimaste fuori stagione e decide. Stessa regola di §8.2. |
| Sede che esce dal periodo con prenotazioni future | Le prenotazioni restano valide e visibili al loro titolare. La sede sparisce dalla vista di ricerca, non dalle prenotazioni già confermate. |
| Nome pubblico azzerato dall'amministratore | Le prenotazioni restano attive e valide. Sparisce solo il nome dalle pagine pubbliche. L'utente riceve l'avviso di §6.5. |
| Utente che supera `MAX_CAMBI_NOME_GIORNO` | Il nome non si può cambiare fino al giorno successivo. Messaggio esplicito con l'ora in cui sarà di nuovo possibile. Nessuna email parte all'amministratore. |
| Utente che revoca i dati facoltativi | I cinque campi del profilo vengono svuotati subito e non verranno più copiati su nessuna prenotazione. I valori già copiati nei campi `stat_` di prenotazioni anonimizzate **restano**: non sono più riconducibili a lui, quindi non sono più un suo dato personale. Va detto nell'informativa. |
| Registrazione con tutti i campi facoltativi vuoti | Registrazione completata normalmente. Nessun promemoria successivo, nessun banner ricorrente. |

---

## 9. Fuori dall'MVP

Da non costruire ora. In ordine di priorità:

1. ==**Etichette di competenze e interessi** accanto al nome pubblico ("grafica", "analisi dati", "cerco compagni di escursione"). È il passaggio da "so chi c'è" a "so con chi mi conviene incrociarmi".
2. **Check-in con QR in sede** e liberazione automatica del posto dopo 30 minuti di assenza.
3. ==**Lista d'attesa** con avviso automatico quando si libera un posto.
4. **Prenotazioni ricorrenti** ("ogni martedì mattina fino a dicembre"). ⚠️ Incompatibile con la finestra di prenotazione (D8): una ricorrenza che generasse prenotazioni oltre la finestra la aggirerebbe. Se in futuro si vorrà questa funzione, andrà ripensata come *promemoria* ("ricordami ogni lunedì di prenotare per il martedì") anziché come prenotazione anticipata — oppure si dovrà rivedere D8.
5. **Bot Telegram** per notifiche e prenotazione rapida.
6. **Inglese e francese** (l'MVP è solo in italiano, ma i testi vanno tenuti separati dal codice fin da subito per non dover riscrivere tutto).
7. **Postazioni differenziate** (monitor, sala silenziosa, sala riunioni), se e quando ci saranno.
8. **Collegamento con gli eventi** di MontagneOltre e della valle.

---

## 10. Parametri configurabili

Valori che devono essere modificabili senza toccare la logica del programma. Vivono in un unico file di configurazione (`config/limits.ts`): cambiarli richiede un rilascio, non una riscrittura. `FINESTRA_GIORNI` ha una copia nel database, usata dalle regole di accesso del referente; un test automatico verifica che le due copie coincidano.

| Parametro | Valore iniziale |
|---|---|
| `FINESTRA_GIORNI` — giorni prenotabili oltre oggi | **14** |
| `ORA_APERTURA_FINESTRA` — ora in cui si apre il nuovo giorno | **00:00** (Europe/Rome) |
| Massimo prenotazioni attive per utente | **nessun limite** (D7) |
| Massimo prenotazioni a settimana per utente | **nessun limite** (D7) |
| Validità del link di accesso | 15 minuti |
| `MAX_LINK_PER_EMAIL_ORA` — richieste di link per email all'ora | **5** |
| `MAX_LINK_PER_RETE_ORA` — richieste di link per indirizzo di rete all'ora | **20** |
| Durata della sessione | 30 giorni dall'ultimo utilizzo |
| Giorni prima dell'anonimizzazione | 30 |
| Mesi prima della cancellazione di un account dormiente | 24 |
| `EMAIL_MODERAZIONE` — destinatario degli avvisi sui nomi pubblici (§6.5) | da definire, casella del Direttivo, **mai un indirizzo personale** |
| `EMAIL_MITTENTE` — mittente di tutte le email dell'app (D12) | `noreply@coworking.sassifraga.org` |
| `MAX_CAMBI_NOME_GIORNO` — modifiche del nome pubblico per utente al giorno | **3** |
| `SOGLIA_ULTIMI_POSTI` — posti liberi da cui la cella avvisa "ultimo posto" | **1** |
| `URL_INFORMATIVA_PRIVACY` — indirizzo dell'informativa linkata prima dell'accesso (§6.1) | da definire, pagina su `www.sassifraga.org` |

**`FINESTRA_GIORNI` è una fonte di verità unica.** Governa insieme la validazione della prenotazione, la vista di disponibilità e la pagina pubblica. I tre valori devono coincidere per costruzione, non essere impostati separatamente: altrimenti l'app finirebbe per mostrare giorni non prenotabili o nascondere giorni prenotabili.

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
9. Email automatiche e allegato calendario
10. Diritti dell'interessato: scarica dati, cancella account
11. Pulizie automatiche notturne
12. Statistiche ed esportazione
13. Installabilità sul telefono e funzionamento offline in lettura

Ogni passo si considera concluso solo quando funziona, è salvato nel controllo di versione, e i test passano.

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
| Icona per l'installazione su telefono | Quadrata, 512×512px, logo su fondo pieno (crema o verde), con margine interno |

---

## 14. Dominio, posta e collocazione

### 14.1 Indirizzo del servizio

Il servizio vive su **`prenota.sassifraga.org`** (D11).

Non su `www.sassifraga.org/coworking`: il sito istituzionale è costruito con Google Sites, che non consente di dirottare una sottocartella verso un'applicazione esterna. Non è una limitazione aggirabile.

Il sottodominio si crea con un singolo record DNS presso il registrar di `sassifraga.org` e non tocca in alcun modo il sito esistente.

**Da non fare: incorporare l'app dentro una pagina del sito.** Google Sites permette di mostrare pagine esterne dentro un riquadro incorporato, ed è la strada che sembra dare più continuità. I browser moderni — Safari e iOS in particolare — bloccano però i cookie dei siti mostrati dentro un riquadro altrui: il cookie di sessione non sopravvivrebbe e **l'accesso smetterebbe di funzionare per tutti gli utenti iPhone**. In più l'app non sarebbe installabile sulla schermata Home. La continuità si ottiene invece con l'identità visiva (§13) e con una pagina "Coworking" sul sito che rimanda al sottodominio.

### 14.2 Posta in uscita

Tutte le email dell'app partono da **`noreply@coworking.sassifraga.org`** (D12), mai dal dominio principale.

La ragione è concreta: `sassifraga.org` ha già i record di posta di Google Workspace. Aggiungere un secondo mittente autorizzato sul dominio principale, se fatto male, può far finire nello spam **anche la posta istituzionale di `info@sassifraga.org`** — un danno più grave del problema che si sta risolvendo. Autenticando un sottodominio separato, reputazione e configurazione restano isolate.

Tetti da tenere presenti: il piano gratuito del fornitore di posta transazionale ha un limite giornaliero di invii **condiviso** fra conferme di prenotazione, avvisi di moderazione e avvisi di cancellazione. È il motivo per cui esiste `MAX_CAMBI_NOME_GIORNO` (§10).

### 14.3 Cosa resta sul sito istituzionale

Le pagine informative — presentazione del coworking, contatti, informativa privacy — restano su Google Sites, dove chiunque nel Direttivo può modificarle senza toccare codice. L'app costruisce solo le parti dinamiche: disponibilità, prenotazione, "Chi c'è in Valle", profilo, amministrazione.

### 14.4 Da verificare prima del rilascio

- **Chi controlla il registrar di `sassifraga.org`.** Serve accesso ai record DNS. Se è nelle mani di una sola persona o di un account personale, va spostato su un account dell'associazione con almeno due amministratori: perdere il dominio significherebbe perdere sito, posta istituzionale e app insieme.
- **L'informativa privacy dell'app è un documento nuovo**, non quella del sito: tratta dati diversi per finalità diverse. Va linkata dall'app prima della registrazione (§6.1).
