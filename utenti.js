// Configurazione ruoli TOP HOUSE.
// Le password NON vanno salvate qui: sono gestite da Firebase Authentication.
// Inserisci gli UID Firebase degli utenti creati nella console Authentication.
export const TOPHOUSE_ROLES = {
  admin: [
    // "UID_FIREBASE_ADMIN_1"
  ],
  venditore: [
    // "UID_FIREBASE_VENDITORE_1"
  ]
};

export const DEFAULT_ROLE = 'venditore';
