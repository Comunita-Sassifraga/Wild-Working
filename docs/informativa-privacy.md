# Informativa privacy — dove si trova

**Il testo in vigore non è più in questo file.**

L'informativa è pubblicata sul sito istituzionale, all'indirizzo:

**<https://www.sassifraga.org/trasparenza/privacy>**

È la versione del 15/09/2026, ed è **una sola informativa** per tutto ciò che
fa l'Associazione: soci, newsletter, eventi, questionari, candidature VIHTA, e
i due servizi di questa applicazione. La bozza che stava qui, scritta per la
sola applicazione, è stata fusa con quella già esistente per il sito — così una
persona che prenota una postazione e poi si candida a VIHTA legge un documento
solo, invece di due che nel giro di un anno si contraddirebbero.

Quell'indirizzo è anche il valore di `URL_INFORMATIVA_PRIVACY` in
`config/limits.ts`, che l'applicazione mostra nel piè di pagina di ogni pagina
e sopra il pulsante di accesso (§6.1, §14.4). **Se l'informativa si sposta, va
cambiata quella costante, ricompilato e ripubblicato**: non basta modificare la
pagina sul sito.

## Come si modifica

Il testo si modifica **su Google Sites**, dal Direttivo, senza passare da qui.
Questo repository non ne tiene una copia, di proposito: due copie dello stesso
documento legale divergono, e quella nel codice sarebbe la più facile da
dimenticare.

Quando una modifica riguarda il comportamento dell'applicazione — conservazione
dei dati, campi raccolti, destinatari, base giuridica — va concordata con chi
lavora al codice **prima** di pubblicarla, perché l'informativa deve descrivere
ciò che il software fa davvero e non ciò che vorremmo facesse. Il verso opposto
vale allo stesso modo: una modifica al software che cambi uno di quei punti
richiede di aggiornare la pagina.

## L'informativa degli abitanti è un'altra cosa

`informativa-abitanti.md`, in questa stessa cartella, **resta dov'è**. Non è una
pagina web e non è coperta dall'informativa pubblicata: è il foglio che gli
abitanti che propongono un'attività in «Prenota un abitante» ricevono e
firmano, su carta o per email, prima che i loro dati possano essere pubblicati
(SPEC §15.8, §15.14). Quelle persone non hanno un account e non useranno mai
l'applicazione: il loro consenso non è digitale e il loro testo non vive online.
