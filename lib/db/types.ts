export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      abilitazioni: {
        Row: {
          attiva: boolean
          attivata_il: string
          edizione_id: string
          id: string
          origine: Database["public"]["Enums"]["origine_abilitazione"]
          revocata_da: string | null
          revocata_il: string | null
          utente_id: string
        }
        Insert: {
          attiva?: boolean
          attivata_il?: string
          edizione_id: string
          id?: string
          origine: Database["public"]["Enums"]["origine_abilitazione"]
          revocata_da?: string | null
          revocata_il?: string | null
          utente_id: string
        }
        Update: {
          attiva?: boolean
          attivata_il?: string
          edizione_id?: string
          id?: string
          origine?: Database["public"]["Enums"]["origine_abilitazione"]
          revocata_da?: string | null
          revocata_il?: string | null
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abilitazioni_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_revocata_da_fkey"
            columns: ["revocata_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_revocata_da_fkey"
            columns: ["revocata_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_revocata_da_fkey"
            columns: ["revocata_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      account_chiusi: {
        Row: {
          chiuso_il: string
          utente_id: string
        }
        Insert: {
          chiuso_il?: string
          utente_id: string
        }
        Update: {
          chiuso_il?: string
          utente_id?: string
        }
        Relationships: []
      }
      attivita: {
        Row: {
          abitante_cognome: string | null
          abitante_nome: string | null
          abitante_note_interne: string | null
          abitante_telefono: string | null
          capienza: number | null
          consenso_modalita:
            | Database["public"]["Enums"]["modalita_consenso"]
            | null
          consenso_raccolto: boolean
          consenso_raccolto_da: string | null
          consenso_raccolto_il: string | null
          cosa_portare: string | null
          creata_il: string
          data: string | null
          descrizione: string | null
          edizione_id: string
          id: string
          lingua_attivita: string | null
          luogo_esatto: string | null
          luogo_generico: string | null
          ora_fine: string | null
          ora_inizio: string | null
          stato: Database["public"]["Enums"]["stato_attivita"]
          titolo: string | null
        }
        Insert: {
          abitante_cognome?: string | null
          abitante_nome?: string | null
          abitante_note_interne?: string | null
          abitante_telefono?: string | null
          capienza?: number | null
          consenso_modalita?:
            | Database["public"]["Enums"]["modalita_consenso"]
            | null
          consenso_raccolto?: boolean
          consenso_raccolto_da?: string | null
          consenso_raccolto_il?: string | null
          cosa_portare?: string | null
          creata_il?: string
          data?: string | null
          descrizione?: string | null
          edizione_id: string
          id?: string
          lingua_attivita?: string | null
          luogo_esatto?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stato?: Database["public"]["Enums"]["stato_attivita"]
          titolo?: string | null
        }
        Update: {
          abitante_cognome?: string | null
          abitante_nome?: string | null
          abitante_note_interne?: string | null
          abitante_telefono?: string | null
          capienza?: number | null
          consenso_modalita?:
            | Database["public"]["Enums"]["modalita_consenso"]
            | null
          consenso_raccolto?: boolean
          consenso_raccolto_da?: string | null
          consenso_raccolto_il?: string | null
          cosa_portare?: string | null
          creata_il?: string
          data?: string | null
          descrizione?: string | null
          edizione_id?: string
          id?: string
          lingua_attivita?: string | null
          luogo_esatto?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stato?: Database["public"]["Enums"]["stato_attivita"]
          titolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attivita_consenso_raccolto_da_fkey"
            columns: ["consenso_raccolto_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attivita_consenso_raccolto_da_fkey"
            columns: ["consenso_raccolto_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attivita_consenso_raccolto_da_fkey"
            columns: ["consenso_raccolto_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attivita_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
        ]
      }
      cambi_nome: {
        Row: {
          cambiato_il: string
          id: string
          utente_id: string
        }
        Insert: {
          cambiato_il?: string
          id?: string
          utente_id: string
        }
        Update: {
          cambiato_il?: string
          id?: string
          utente_id?: string
        }
        Relationships: []
      }
      chiusure: {
        Row: {
          creata_da: string | null
          data_fine: string
          data_inizio: string
          fascia: Database["public"]["Enums"]["fascia"] | null
          id: string
          sede_id: string
        }
        Insert: {
          creata_da?: string | null
          data_fine: string
          data_inizio: string
          fascia?: Database["public"]["Enums"]["fascia"] | null
          id?: string
          sede_id: string
        }
        Update: {
          creata_da?: string | null
          data_fine?: string
          data_inizio?: string
          fascia?: Database["public"]["Enums"]["fascia"] | null
          id?: string
          sede_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chiusure_creata_da_fkey"
            columns: ["creata_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_creata_da_fkey"
            columns: ["creata_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_creata_da_fkey"
            columns: ["creata_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "chiusure_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "chiusure_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      codici_invito: {
        Row: {
          creato_il: string
          edizione_id: string
          id: string
          impronta: string
          progressivo: number
          revocato: boolean
          usato_il: string | null
          utente_id: string | null
        }
        Insert: {
          creato_il?: string
          edizione_id: string
          id?: string
          impronta: string
          progressivo: number
          revocato?: boolean
          usato_il?: string | null
          utente_id?: string | null
        }
        Update: {
          creato_il?: string
          edizione_id?: string
          id?: string
          impronta?: string
          progressivo?: number
          revocato?: boolean
          usato_il?: string | null
          utente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codici_invito_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_invito_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_invito_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_invito_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      consensi: {
        Row: {
          data_ora: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_consenso"]
          utente_id: string
          valore: Database["public"]["Enums"]["valore_consenso"]
        }
        Insert: {
          data_ora?: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_consenso"]
          utente_id: string
          valore: Database["public"]["Enums"]["valore_consenso"]
        }
        Update: {
          data_ora?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_consenso"]
          utente_id?: string
          valore?: Database["public"]["Enums"]["valore_consenso"]
        }
        Relationships: []
      }
      edizioni: {
        Row: {
          attiva: boolean
          creata_il: string
          data_fine: string
          data_inizio: string
          id: string
          nome: string
        }
        Insert: {
          attiva?: boolean
          creata_il?: string
          data_fine: string
          data_inizio: string
          id?: string
          nome: string
        }
        Update: {
          attiva?: boolean
          creata_il?: string
          data_fine?: string
          data_inizio?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      incarichi: {
        Row: {
          attivo: boolean
          id: string
          ruolo: Database["public"]["Enums"]["ruolo_incarico"]
          sede_id: string | null
          utente_id: string
        }
        Insert: {
          attivo?: boolean
          id?: string
          ruolo: Database["public"]["Enums"]["ruolo_incarico"]
          sede_id?: string | null
          utente_id: string
        }
        Update: {
          attivo?: boolean
          id?: string
          ruolo?: Database["public"]["Enums"]["ruolo_incarico"]
          sede_id?: string | null
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incarichi_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "incarichi_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "incarichi_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incarichi_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incarichi_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incarichi_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incarichi_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni: {
        Row: {
          annullata_da: string | null
          annullata_il: string | null
          anonimizzata: boolean
          attivita_id: string
          creata_da: string | null
          creata_il: string
          id: string
          posto_progressivo: number
          stat_eta: Database["public"]["Enums"]["fascia_eta"] | null
          stat_genere: Database["public"]["Enums"]["genere"] | null
          stat_motivo_visita: string | null
          stat_professione: string | null
          stat_residenza: Database["public"]["Enums"]["residenza"] | null
          stato: Database["public"]["Enums"]["stato_iscrizione"]
          utente_id: string | null
        }
        Insert: {
          annullata_da?: string | null
          annullata_il?: string | null
          anonimizzata?: boolean
          attivita_id: string
          creata_da?: string | null
          creata_il?: string
          id?: string
          posto_progressivo: number
          stat_eta?: Database["public"]["Enums"]["fascia_eta"] | null
          stat_genere?: Database["public"]["Enums"]["genere"] | null
          stat_motivo_visita?: string | null
          stat_professione?: string | null
          stat_residenza?: Database["public"]["Enums"]["residenza"] | null
          stato?: Database["public"]["Enums"]["stato_iscrizione"]
          utente_id?: string | null
        }
        Update: {
          annullata_da?: string | null
          annullata_il?: string | null
          anonimizzata?: boolean
          attivita_id?: string
          creata_da?: string | null
          creata_il?: string
          id?: string
          posto_progressivo?: number
          stat_eta?: Database["public"]["Enums"]["fascia_eta"] | null
          stat_genere?: Database["public"]["Enums"]["genere"] | null
          stat_motivo_visita?: string | null
          stat_professione?: string | null
          stat_residenza?: Database["public"]["Enums"]["residenza"] | null
          stato?: Database["public"]["Enums"]["stato_iscrizione"]
          utente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_annullata_da_fkey"
            columns: ["annullata_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_annullata_da_fkey"
            columns: ["annullata_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_annullata_da_fkey"
            columns: ["annullata_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_attivita_id_fkey"
            columns: ["attivita_id"]
            isOneToOne: false
            referencedRelation: "attivita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_attivita_id_fkey"
            columns: ["attivita_id"]
            isOneToOne: false
            referencedRelation: "attivita_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_attivita_id_fkey"
            columns: ["attivita_id"]
            isOneToOne: false
            referencedRelation: "attivita_elenco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_attivita_id_fkey"
            columns: ["attivita_id"]
            isOneToOne: false
            referencedRelation: "attivita_iscritto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_creata_da_fkey"
            columns: ["creata_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_creata_da_fkey"
            columns: ["creata_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_creata_da_fkey"
            columns: ["creata_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      moderazioni: {
        Row: {
          amministratore_id: string | null
          avvenuta_il: string
          id: string
          nome_rimosso: string
          utente_id: string
        }
        Insert: {
          amministratore_id?: string | null
          avvenuta_il?: string
          id?: string
          nome_rimosso: string
          utente_id: string
        }
        Update: {
          amministratore_id?: string | null
          avvenuta_il?: string
          id?: string
          nome_rimosso?: string
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderazioni_amministratore_id_fkey"
            columns: ["amministratore_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderazioni_amministratore_id_fkey"
            columns: ["amministratore_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderazioni_amministratore_id_fkey"
            columns: ["amministratore_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      periodi_attivita: {
        Row: {
          data_fine: string
          data_inizio: string
          etichetta: string
          id: string
          ricorre_ogni_anno: boolean
          sede_id: string
        }
        Insert: {
          data_fine: string
          data_inizio: string
          etichetta: string
          id?: string
          ricorre_ogni_anno?: boolean
          sede_id: string
        }
        Update: {
          data_fine?: string
          data_inizio?: string
          etichetta?: string
          id?: string
          ricorre_ogni_anno?: boolean
          sede_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodi_attivita_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "periodi_attivita_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "periodi_attivita_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodi_attivita_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      persone_per_mese: {
        Row: {
          id: string
          mese: string
          persone: number
          sede_id: string | null
        }
        Insert: {
          id?: string
          mese: string
          persone?: number
          sede_id?: string | null
        }
        Update: {
          id?: string
          mese?: string
          persone?: number
          sede_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persone_per_mese_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "persone_per_mese_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "persone_per_mese_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persone_per_mese_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      posti_offerti: {
        Row: {
          data: string
          fascia: Database["public"]["Enums"]["fascia"]
          posti: number
          sede_id: string
        }
        Insert: {
          data: string
          fascia: Database["public"]["Enums"]["fascia"]
          posti: number
          sede_id: string
        }
        Update: {
          data?: string
          fascia?: Database["public"]["Enums"]["fascia"]
          posti?: number
          sede_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posti_offerti_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "posti_offerti_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "posti_offerti_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posti_offerti_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      prenotazioni: {
        Row: {
          anonimizzata: boolean
          creata_il: string
          data: string
          fascia: Database["public"]["Enums"]["fascia"]
          gruppo_id: string | null
          id: string
          posto_progressivo: number
          promemoria_inviato_il: string | null
          sede_id: string
          stat_eta: Database["public"]["Enums"]["fascia_eta"] | null
          stat_genere: Database["public"]["Enums"]["genere"] | null
          stat_motivo_visita: string | null
          stat_professione: string | null
          stat_residenza: Database["public"]["Enums"]["residenza"] | null
          stato: Database["public"]["Enums"]["stato_prenotazione"]
          utente_id: string | null
        }
        Insert: {
          anonimizzata?: boolean
          creata_il?: string
          data: string
          fascia: Database["public"]["Enums"]["fascia"]
          gruppo_id?: string | null
          id?: string
          posto_progressivo: number
          promemoria_inviato_il?: string | null
          sede_id: string
          stat_eta?: Database["public"]["Enums"]["fascia_eta"] | null
          stat_genere?: Database["public"]["Enums"]["genere"] | null
          stat_motivo_visita?: string | null
          stat_professione?: string | null
          stat_residenza?: Database["public"]["Enums"]["residenza"] | null
          stato?: Database["public"]["Enums"]["stato_prenotazione"]
          utente_id?: string | null
        }
        Update: {
          anonimizzata?: boolean
          creata_il?: string
          data?: string
          fascia?: Database["public"]["Enums"]["fascia"]
          gruppo_id?: string | null
          id?: string
          posto_progressivo?: number
          promemoria_inviato_il?: string | null
          sede_id?: string
          stat_eta?: Database["public"]["Enums"]["fascia_eta"] | null
          stat_genere?: Database["public"]["Enums"]["genere"] | null
          stat_motivo_visita?: string | null
          stat_professione?: string | null
          stat_residenza?: Database["public"]["Enums"]["residenza"] | null
          stato?: Database["public"]["Enums"]["stato_prenotazione"]
          utente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      richieste_link: {
        Row: {
          id: string
          impronta_email: string
          impronta_rete: string
          richiesta_il: string
        }
        Insert: {
          id?: string
          impronta_email: string
          impronta_rete: string
          richiesta_il?: string
        }
        Update: {
          id?: string
          impronta_email?: string
          impronta_rete?: string
          richiesta_il?: string
        }
        Relationships: []
      }
      sedi: {
        Row: {
          attiva: boolean
          capienza: number
          comune: string
          coordinate: unknown
          giorni_apertura: Database["public"]["Enums"]["giorno_settimana"][]
          id: string
          indirizzo: string | null
          nome: string
          note: string | null
          ora_fine_mattina: string
          ora_fine_pomeriggio: string
          ora_inizio_mattina: string
          ora_inizio_pomeriggio: string
          sempre_disponibile: boolean
        }
        Insert: {
          attiva?: boolean
          capienza: number
          comune: string
          coordinate?: unknown
          giorni_apertura?: Database["public"]["Enums"]["giorno_settimana"][]
          id?: string
          indirizzo?: string | null
          nome: string
          note?: string | null
          ora_fine_mattina?: string
          ora_fine_pomeriggio?: string
          ora_inizio_mattina?: string
          ora_inizio_pomeriggio?: string
          sempre_disponibile?: boolean
        }
        Update: {
          attiva?: boolean
          capienza?: number
          comune?: string
          coordinate?: unknown
          giorni_apertura?: Database["public"]["Enums"]["giorno_settimana"][]
          id?: string
          indirizzo?: string | null
          nome?: string
          note?: string | null
          ora_fine_mattina?: string
          ora_fine_pomeriggio?: string
          ora_inizio_mattina?: string
          ora_inizio_pomeriggio?: string
          sempre_disponibile?: boolean
        }
        Relationships: []
      }
      tentativi_codice: {
        Row: {
          id: string
          tentato_il: string
          utente_id: string
        }
        Insert: {
          id?: string
          tentato_il?: string
          utente_id: string
        }
        Update: {
          id?: string
          tentato_il?: string
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tentativi_codice_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativi_codice_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativi_codice_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      termini_vietati: {
        Row: {
          creato_da: string | null
          creato_il: string
          id: string
          termine: string
        }
        Insert: {
          creato_da?: string | null
          creato_il?: string
          id?: string
          termine: string
        }
        Update: {
          creato_da?: string | null
          creato_il?: string
          id?: string
          termine?: string
        }
        Relationships: [
          {
            foreignKeyName: "termini_vietati_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termini_vietati_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termini_vietati_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      utenti: {
        Row: {
          avviso_dormienza_il: string | null
          avviso_moderazione: string | null
          creato_il: string
          email: string
          eta: Database["public"]["Enums"]["fascia_eta"] | null
          genere: Database["public"]["Enums"]["genere"] | null
          id: string
          lingua: Database["public"]["Enums"]["lingua"]
          mostra_nome_pubblico: boolean
          motivo_visita: string | null
          nome_pubblico: string | null
          professione: string | null
          residenza: Database["public"]["Enums"]["residenza"] | null
          ultimo_accesso: string
        }
        Insert: {
          avviso_dormienza_il?: string | null
          avviso_moderazione?: string | null
          creato_il?: string
          email: string
          eta?: Database["public"]["Enums"]["fascia_eta"] | null
          genere?: Database["public"]["Enums"]["genere"] | null
          id: string
          lingua?: Database["public"]["Enums"]["lingua"]
          mostra_nome_pubblico?: boolean
          motivo_visita?: string | null
          nome_pubblico?: string | null
          professione?: string | null
          residenza?: Database["public"]["Enums"]["residenza"] | null
          ultimo_accesso?: string
        }
        Update: {
          avviso_dormienza_il?: string | null
          avviso_moderazione?: string | null
          creato_il?: string
          email?: string
          eta?: Database["public"]["Enums"]["fascia_eta"] | null
          genere?: Database["public"]["Enums"]["genere"] | null
          id?: string
          lingua?: Database["public"]["Enums"]["lingua"]
          mostra_nome_pubblico?: boolean
          motivo_visita?: string | null
          nome_pubblico?: string | null
          professione?: string | null
          residenza?: Database["public"]["Enums"]["residenza"] | null
          ultimo_accesso?: string
        }
        Relationships: []
      }
    }
    Views: {
      abilitazioni_amministrazione: {
        Row: {
          attiva: boolean | null
          attivata_il: string | null
          edizione_id: string | null
          email: string | null
          id: string | null
          origine: Database["public"]["Enums"]["origine_abilitazione"] | null
          revocata_il: string | null
          utente_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abilitazioni_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abilitazioni_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      aperture_future: {
        Row: {
          data_apertura: string | null
          etichetta: string | null
          sede_id: string | null
        }
        Relationships: []
      }
      attivita_amministrazione: {
        Row: {
          abitante_cognome: string | null
          abitante_nome: string | null
          abitante_note_interne: string | null
          abitante_telefono: string | null
          capienza: number | null
          consenso_modalita:
            | Database["public"]["Enums"]["modalita_consenso"]
            | null
          consenso_raccolto: boolean | null
          consenso_raccolto_da: string | null
          consenso_raccolto_il: string | null
          cosa_portare: string | null
          creata_il: string | null
          data: string | null
          descrizione: string | null
          edizione_id: string | null
          id: string | null
          iscritti: number | null
          lingua_attivita: string | null
          luogo_esatto: string | null
          luogo_generico: string | null
          ora_fine: string | null
          ora_inizio: string | null
          stato: Database["public"]["Enums"]["stato_attivita"] | null
          titolo: string | null
        }
        Insert: {
          abitante_cognome?: string | null
          abitante_nome?: string | null
          abitante_note_interne?: string | null
          abitante_telefono?: string | null
          capienza?: number | null
          consenso_modalita?:
            | Database["public"]["Enums"]["modalita_consenso"]
            | null
          consenso_raccolto?: boolean | null
          consenso_raccolto_da?: string | null
          consenso_raccolto_il?: string | null
          cosa_portare?: string | null
          creata_il?: string | null
          data?: string | null
          descrizione?: string | null
          edizione_id?: string | null
          id?: string | null
          iscritti?: never
          lingua_attivita?: string | null
          luogo_esatto?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stato?: Database["public"]["Enums"]["stato_attivita"] | null
          titolo?: string | null
        }
        Update: {
          abitante_cognome?: string | null
          abitante_nome?: string | null
          abitante_note_interne?: string | null
          abitante_telefono?: string | null
          capienza?: number | null
          consenso_modalita?:
            | Database["public"]["Enums"]["modalita_consenso"]
            | null
          consenso_raccolto?: boolean | null
          consenso_raccolto_da?: string | null
          consenso_raccolto_il?: string | null
          cosa_portare?: string | null
          creata_il?: string | null
          data?: string | null
          descrizione?: string | null
          edizione_id?: string | null
          id?: string | null
          iscritti?: never
          lingua_attivita?: string | null
          luogo_esatto?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stato?: Database["public"]["Enums"]["stato_attivita"] | null
          titolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attivita_consenso_raccolto_da_fkey"
            columns: ["consenso_raccolto_da"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attivita_consenso_raccolto_da_fkey"
            columns: ["consenso_raccolto_da"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attivita_consenso_raccolto_da_fkey"
            columns: ["consenso_raccolto_da"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attivita_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
        ]
      }
      attivita_elenco: {
        Row: {
          abitante_nome: string | null
          capienza: number | null
          cosa_portare: string | null
          data: string | null
          descrizione: string | null
          edizione_id: string | null
          id: string | null
          iscritti: number | null
          lingua_attivita: string | null
          luogo_generico: string | null
          ora_fine: string | null
          ora_inizio: string | null
          posti_rimasti: number | null
          titolo: string | null
        }
        Insert: {
          abitante_nome?: string | null
          capienza?: number | null
          cosa_portare?: string | null
          data?: string | null
          descrizione?: string | null
          edizione_id?: string | null
          id?: string | null
          iscritti?: never
          lingua_attivita?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          posti_rimasti?: never
          titolo?: string | null
        }
        Update: {
          abitante_nome?: string | null
          capienza?: number | null
          cosa_portare?: string | null
          data?: string | null
          descrizione?: string | null
          edizione_id?: string | null
          id?: string | null
          iscritti?: never
          lingua_attivita?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          posti_rimasti?: never
          titolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attivita_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
        ]
      }
      attivita_iscritto: {
        Row: {
          abitante_cognome: string | null
          abitante_nome: string | null
          abitante_telefono: string | null
          capienza: number | null
          cosa_portare: string | null
          data: string | null
          descrizione: string | null
          edizione_id: string | null
          id: string | null
          lingua_attivita: string | null
          luogo_esatto: string | null
          luogo_generico: string | null
          ora_fine: string | null
          ora_inizio: string | null
          stato: Database["public"]["Enums"]["stato_attivita"] | null
          titolo: string | null
        }
        Insert: {
          abitante_cognome?: string | null
          abitante_nome?: string | null
          abitante_telefono?: string | null
          capienza?: number | null
          cosa_portare?: string | null
          data?: string | null
          descrizione?: string | null
          edizione_id?: string | null
          id?: string | null
          lingua_attivita?: string | null
          luogo_esatto?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stato?: Database["public"]["Enums"]["stato_attivita"] | null
          titolo?: string | null
        }
        Update: {
          abitante_cognome?: string | null
          abitante_nome?: string | null
          abitante_telefono?: string | null
          capienza?: number | null
          cosa_portare?: string | null
          data?: string | null
          descrizione?: string | null
          edizione_id?: string | null
          id?: string | null
          lingua_attivita?: string | null
          luogo_esatto?: string | null
          luogo_generico?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stato?: Database["public"]["Enums"]["stato_attivita"] | null
          titolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attivita_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
        ]
      }
      codici_amministrazione: {
        Row: {
          creato_il: string | null
          edizione_id: string | null
          id: string | null
          progressivo: number | null
          revocato: boolean | null
          usato_il: string | null
          utente_id: string | null
        }
        Insert: {
          creato_il?: string | null
          edizione_id?: string | null
          id?: string | null
          progressivo?: number | null
          revocato?: boolean | null
          usato_il?: string | null
          utente_id?: string | null
        }
        Update: {
          creato_il?: string | null
          edizione_id?: string | null
          id?: string | null
          progressivo?: number | null
          revocato?: boolean | null
          usato_il?: string | null
          utente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codici_invito_edizione_id_fkey"
            columns: ["edizione_id"]
            isOneToOne: false
            referencedRelation: "edizioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_invito_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "nomi_pubblici_moderazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_invito_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_invito_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_amministrazione"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilita_pubblica: {
        Row: {
          capienza: number | null
          data: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          in_stagione: boolean | null
          liberi: number | null
          prenotabile: boolean | null
          prenotati: number | null
          pubbliche: number | null
          sede_id: string | null
        }
        Relationships: []
      }
      mie_prenotazioni: {
        Row: {
          annullabile: boolean | null
          comune: string | null
          creata_il: string | null
          data: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          gruppo_id: string | null
          id: string | null
          indirizzo: string | null
          note: string | null
          ora_fine: string | null
          ora_inizio: string | null
          sede_id: string | null
          sede_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      miei_dati_prenotazioni: {
        Row: {
          comune: string | null
          creata_il: string | null
          data: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          gruppo_id: string | null
          id: string | null
          indirizzo: string | null
          ora_fine: string | null
          ora_inizio: string | null
          sede_nome: string | null
          stato: Database["public"]["Enums"]["stato_prenotazione"] | null
        }
        Relationships: []
      }
      nomi_pubblici_moderazione: {
        Row: {
          avviso_in_attesa: boolean | null
          id: string | null
          mostra_nome_pubblico: boolean | null
          nome_pubblico: string | null
        }
        Insert: {
          avviso_in_attesa?: never
          id?: string | null
          mostra_nome_pubblico?: boolean | null
          nome_pubblico?: string | null
        }
        Update: {
          avviso_in_attesa?: never
          id?: string | null
          mostra_nome_pubblico?: boolean | null
          nome_pubblico?: string | null
        }
        Relationships: []
      }
      occupazione_pubblica: {
        Row: {
          data: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          prenotati: number | null
          pubbliche: number | null
          sede_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      prenotazioni_da_verificare: {
        Row: {
          data: string | null
          email: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          motivo: string | null
          prenotazione_id: string | null
          sede_id: string | null
          sede_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      prenotazioni_referente: {
        Row: {
          creata_il: string | null
          data: string | null
          email: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          gruppo_id: string | null
          id: string | null
          nome_pubblico: string | null
          sede_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      presenze_pubbliche: {
        Row: {
          data: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          nome_pubblico: string | null
          sede_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "aperture_future"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "disponibilita_pubblica"
            referencedColumns: ["sede_id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prenotazioni_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedi_pubbliche"
            referencedColumns: ["id"]
          },
        ]
      }
      sedi_pubbliche: {
        Row: {
          capienza: number | null
          comune: string | null
          coordinate: unknown
          giorni_apertura:
            | Database["public"]["Enums"]["giorno_settimana"][]
            | null
          id: string | null
          indirizzo: string | null
          nome: string | null
          ora_fine_mattina: string | null
          ora_fine_pomeriggio: string | null
          ora_inizio_mattina: string | null
          ora_inizio_pomeriggio: string | null
          sempre_disponibile: boolean | null
        }
        Insert: {
          capienza?: number | null
          comune?: string | null
          coordinate?: unknown
          giorni_apertura?:
            | Database["public"]["Enums"]["giorno_settimana"][]
            | null
          id?: string | null
          indirizzo?: string | null
          nome?: string | null
          ora_fine_mattina?: string | null
          ora_fine_pomeriggio?: string | null
          ora_inizio_mattina?: string | null
          ora_inizio_pomeriggio?: string | null
          sempre_disponibile?: boolean | null
        }
        Update: {
          capienza?: number | null
          comune?: string | null
          coordinate?: unknown
          giorni_apertura?:
            | Database["public"]["Enums"]["giorno_settimana"][]
            | null
          id?: string | null
          indirizzo?: string | null
          nome?: string | null
          ora_fine_mattina?: string | null
          ora_fine_pomeriggio?: string | null
          ora_inizio_mattina?: string | null
          ora_inizio_pomeriggio?: string | null
          sempre_disponibile?: boolean | null
        }
        Relationships: []
      }
      utenti_amministrazione: {
        Row: {
          creato_il: string | null
          email: string | null
          id: string | null
          lingua: Database["public"]["Enums"]["lingua"] | null
          mostra_nome_pubblico: boolean | null
          nome_pubblico: string | null
          ultimo_accesso: string | null
        }
        Insert: {
          creato_il?: string | null
          email?: string | null
          id?: string | null
          lingua?: Database["public"]["Enums"]["lingua"] | null
          mostra_nome_pubblico?: boolean | null
          nome_pubblico?: string | null
          ultimo_accesso?: string | null
        }
        Update: {
          creato_il?: string | null
          email?: string | null
          id?: string | null
          lingua?: Database["public"]["Enums"]["lingua"] | null
          mostra_nome_pubblico?: boolean | null
          nome_pubblico?: string | null
          ultimo_accesso?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      abilita_utente: { Args: { p_utente_id: string }; Returns: string }
      annullabile: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: boolean
      }
      anonimizza_prenotazioni: { Args: { p_giorni: number }; Returns: number }
      attivita_non_cominciata: {
        Args: { p_attivita_id: string }
        Returns: boolean
      }
      avvisi_dormienza_da_inviare: {
        Args: { p_mesi: number }
        Returns: {
          email: string
          ultimo_accesso: string
          utente_id: string
        }[]
      }
      azzera_nome_pubblico: {
        Args: { p_utente_id: string }
        Returns: {
          nome_rimosso: string
        }[]
      }
      cancella_account_dormienti: {
        Args: { p_mesi: number; p_mesi_avviso: number }
        Returns: number
      }
      cancella_consensi_scaduti: { Args: { p_mesi: number }; Returns: number }
      cancella_impronte_scadute: { Args: never; Returns: number }
      cancella_mio_account: { Args: never; Returns: undefined }
      cancella_richieste_incomplete: {
        Args: { p_ore: number }
        Returns: number
      }
      consenti_richiesta_link: {
        Args: {
          p_impronta_email: string
          p_impronta_rete: string
          p_max_email: number
          p_max_rete: number
        }
        Returns: boolean
      }
      consuma_codice: {
        Args: { p_impronta: string; p_max_tentativi: number }
        Returns: string
      }
      conta_persone_in_uscita: {
        Args: { p_soglia?: string; p_utente_id?: string }
        Returns: undefined
      }
      dentro_giorno_mese: {
        Args: { p_data: string; p_fine: string; p_inizio: string }
        Returns: boolean
      }
      edizione_attiva: { Args: never; Returns: string }
      esegui_cancellazione: {
        Args: { p_copia_stat?: boolean; p_utente_id: string }
        Returns: undefined
      }
      fine_finestra: { Args: never; Returns: string }
      finestra_giorni: { Args: never; Returns: number }
      genera_codici: {
        Args: { p_edizione_id: string; p_impronte: string[] }
        Returns: {
          impronta: string
          progressivo: number
        }[]
      }
      giorno_di: {
        Args: { p_data: string }
        Returns: Database["public"]["Enums"]["giorno_settimana"]
      }
      giorno_mese: { Args: { p_data: string }; Returns: number }
      ha_abilitazione: { Args: never; Returns: boolean }
      imposta_nome_pubblico: {
        Args: { p_max_cambi: number; p_mostra: boolean; p_nome: string }
        Returns: {
          cambiato: boolean
          mostra_nome_pubblico: boolean
          nome_pubblico: string
        }[]
      }
      in_chiusura: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: boolean
      }
      in_periodo_attivita: {
        Args: { p_data: string; p_sede_id: string }
        Returns: boolean
      }
      is_amministratore: { Args: never; Returns: boolean }
      is_referente_di: { Args: { p_sede_id: string }; Returns: boolean }
      iscritto_a: { Args: { p_attivita_id: string }; Returns: boolean }
      iscriviti: { Args: { p_attivita_id: string }; Returns: string }
      normalizza_confronto: { Args: { p_testo: string }; Returns: string }
      oggi_roma: { Args: never; Returns: string }
      ora_inizio: {
        Args: {
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: string
      }
      prenota_giornata: {
        Args: { p_data: string; p_sede_id: string }
        Returns: string
      }
      prenota_posto: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: string
      }
      prenota_slot: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_gruppo: string
          p_sede_id: string
        }
        Returns: string
      }
      promemoria_da_inviare: {
        Args: { p_giorno?: string }
        Returns: {
          comune: string
          data: string
          email: string
          fascia: Database["public"]["Enums"]["fascia"]
          indirizzo: string
          note: string
          ora_fine: string
          ora_inizio: string
          prenotazione_id: string
          sede_nome: string
          utente_id: string
        }[]
      }
      registra_accesso: { Args: never; Returns: boolean }
      registra_posti_offerti: {
        Args: { p_da?: string; p_fino_a?: string }
        Returns: number
      }
      revoca_abilitazione: {
        Args: { p_abilitazione_id: string }
        Returns: undefined
      }
      revoca_codice: { Args: { p_codice_id: string }; Returns: undefined }
      sede_aperta: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: boolean
      }
      sede_attiva: { Args: { p_sede_id: string }; Returns: boolean }
      sede_in_stagione: {
        Args: { p_data: string; p_sede_id: string }
        Returns: boolean
      }
      sede_prenotabile: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      fascia: "MATTINA" | "POMERIGGIO"
      fascia_eta: "18-25" | "26-35" | "36-50" | "51-65" | "Oltre 65"
      genere: "M" | "F" | "Preferisco non rispondere"
      giorno_settimana: "LUN" | "MAR" | "MER" | "GIO" | "VEN" | "SAB" | "DOM"
      lingua: "it" | "en" | "fr"
      modalita_consenso: "MODULO_CARTACEO_FIRMATO" | "EMAIL_DI_CONSENSO"
      origine_abilitazione: "CODICE" | "MANUALE"
      residenza: "Valle Soana" | "Canavese" | "Piemonte" | "Italia" | "Altro"
      ruolo_incarico: "REFERENTE" | "AMMINISTRATORE"
      stato_attivita: "BOZZA" | "PUBBLICATA" | "ANNULLATA"
      stato_iscrizione: "ATTIVA" | "ANNULLATA"
      stato_prenotazione: "ATTIVA" | "ANNULLATA"
      tipo_consenso: "NOME_PUBBLICO" | "DATI_FACOLTATIVI"
      valore_consenso: "DATO" | "REVOCATO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      fascia: ["MATTINA", "POMERIGGIO"],
      fascia_eta: ["18-25", "26-35", "36-50", "51-65", "Oltre 65"],
      genere: ["M", "F", "Preferisco non rispondere"],
      giorno_settimana: ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"],
      lingua: ["it", "en", "fr"],
      modalita_consenso: ["MODULO_CARTACEO_FIRMATO", "EMAIL_DI_CONSENSO"],
      origine_abilitazione: ["CODICE", "MANUALE"],
      residenza: ["Valle Soana", "Canavese", "Piemonte", "Italia", "Altro"],
      ruolo_incarico: ["REFERENTE", "AMMINISTRATORE"],
      stato_attivita: ["BOZZA", "PUBBLICATA", "ANNULLATA"],
      stato_iscrizione: ["ATTIVA", "ANNULLATA"],
      stato_prenotazione: ["ATTIVA", "ANNULLATA"],
      tipo_consenso: ["NOME_PUBBLICO", "DATI_FACOLTATIVI"],
      valore_consenso: ["DATO", "REVOCATO"],
    },
  },
} as const

