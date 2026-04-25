export const translations = {
  ca: {
    common: {
      patient: "Pacient",
      caregiver: "Cuidador",
      loading: "Carregant...",
      error: "Error",
    },
    home: {
      brand_tagline: "Geo-protecció discreta",
      im_patient: "Sóc el Pacient",
      im_caregiver: "Sóc el Cuidador",
      footer_text: "Seguretat i acompanyament sense alarmisme per a tota la família.",
    },
    patient: {
      status_active: "Passeig en curs",
      status_inactive: "Inactiu",
      status_walking: "Passeig en curs",
      status_idle: "Bon dia",
      desc_walking: "T'estem acompanyant en tot moment.",
      desc_idle: "Quan vulguis sortir, prem el botó.",
      btn_start: "Comença a passejar",
      btn_stop: "Parem el passeig",
      alert_safe: "El teu cuidador sap on ets. Camina tranquil.",
    },
    caregiver: {
      title: "Estat del Pacient",
      online: "En línia",
      stat_status: "Estat actual",
      stat_last_seen: "Última ubicació",
      stat_safe_zone: "Zona de seguretat",
      stat_history: "Historial",
      val_walking: "Passeig en curs",
      val_started: "Iniciat fa {min} minuts",
      val_seen: "Vist fa {min} minuts",
      val_safe_active: "Zona segura activa",
      val_radius: "Radi de {m}m",
      val_history_desc: "Veure rutes d'avui",
      alert_connected: "Connexió restablerta correctament.",
    }
  },
  en: {
    common: {
      patient: "Patient",
      caregiver: "Caregiver",
      loading: "Loading...",
      error: "Error",
    },
    home: {
      brand_tagline: "Discreet geo-protection",
      im_patient: "I'm the Patient",
      im_caregiver: "I'm the Caregiver",
      footer_text: "Safety and support without alarmism for the whole family.",
    },
    patient: {
      status_active: "Walk in progress",
      status_inactive: "Not active",
      status_walking: "Walk in progress",
      status_idle: "Good morning",
      desc_walking: "We are accompanying you at all times.",
      desc_idle: "When you want to go out, press the button.",
      btn_start: "Start walk",
      btn_stop: "Stop walk",
      alert_safe: "Your caregiver knows where you are. Walk calmly.",
    },
    caregiver: {
      title: "Patient Status",
      online: "Online",
      stat_status: "Current status",
      stat_last_seen: "Last seen",
      stat_safe_zone: "Safe zone",
      stat_history: "History",
      val_walking: "Walk in progress",
      val_started: "Started {min} minutes ago",
      val_seen: "Seen {min} minutes ago",
      val_safe_active: "Safe zone active",
      val_radius: "Radius of {m}m",
      val_history_desc: "See today's routes",
      alert_connected: "Connection restored successfully.",
    }
  }
};

export type Language = keyof typeof translations;
export type TranslationSchema = typeof translations.ca;
