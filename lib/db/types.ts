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
      prenotazioni: {
        Row: {
          anonimizzata: boolean
          creata_il: string
          data: string
          fascia: Database["public"]["Enums"]["fascia"]
          gruppo_id: string | null
          id: string
          posto_progressivo: number
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
          orario_mattina: string
          orario_pomeriggio: string
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
          orario_mattina?: string
          orario_pomeriggio?: string
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
          orario_mattina?: string
          orario_pomeriggio?: string
          sempre_disponibile?: boolean
        }
        Relationships: []
      }
      utenti: {
        Row: {
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
      occupazione_pubblica: {
        Row: {
          data: string | null
          fascia: Database["public"]["Enums"]["fascia"] | null
          prenotati: number | null
          sede_id: string | null
        }
        Relationships: [
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
          orario_mattina: string | null
          orario_pomeriggio: string | null
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
          orario_mattina?: string | null
          orario_pomeriggio?: string | null
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
          orario_mattina?: string | null
          orario_pomeriggio?: string | null
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
      consenti_richiesta_link: {
        Args: {
          p_impronta_email: string
          p_impronta_rete: string
          p_max_email: number
          p_max_rete: number
        }
        Returns: boolean
      }
      fine_finestra: { Args: never; Returns: string }
      finestra_giorni: { Args: never; Returns: number }
      is_amministratore: { Args: never; Returns: boolean }
      is_referente_di: { Args: { p_sede_id: string }; Returns: boolean }
      oggi_roma: { Args: never; Returns: string }
      prenota_posto: {
        Args: {
          p_data: string
          p_fascia: Database["public"]["Enums"]["fascia"]
          p_sede_id: string
        }
        Returns: string
      }
      registra_accesso: { Args: never; Returns: boolean }
      sede_attiva: { Args: { p_sede_id: string }; Returns: boolean }
    }
    Enums: {
      fascia: "MATTINA" | "POMERIGGIO"
      fascia_eta: "18-25" | "26-35" | "36-50" | "51-65" | "Oltre 65"
      genere: "M" | "F" | "Preferisco non rispondere"
      giorno_settimana: "LUN" | "MAR" | "MER" | "GIO" | "VEN" | "SAB" | "DOM"
      lingua: "it" | "en" | "fr"
      residenza: "Valle Soana" | "Canavese" | "Piemonte" | "Italia" | "Altro"
      ruolo_incarico: "REFERENTE" | "AMMINISTRATORE"
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
      residenza: ["Valle Soana", "Canavese", "Piemonte", "Italia", "Altro"],
      ruolo_incarico: ["REFERENTE", "AMMINISTRATORE"],
      stato_prenotazione: ["ATTIVA", "ANNULLATA"],
      tipo_consenso: ["NOME_PUBBLICO", "DATI_FACOLTATIVI"],
      valore_consenso: ["DATO", "REVOCATO"],
    },
  },
} as const

