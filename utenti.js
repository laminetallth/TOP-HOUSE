// Ruoli utenti TOP HOUSE.
// Le password NON devono essere inserite qui: sono gestite da Firebase Authentication.
// Dopo aver creato gli utenti in Firebase Authentication, copia qui i loro UID.
export const TOPHOUSE_ROLES = {
  admin: [
    // 'UID_FIREBASE_ADMIN_1'
  ],
  venditore: [
    // 'UID_FIREBASE_VENDITORE_1'
  ]
};

// Gli utenti autenticati non presenti negli array sopra vengono trattati come venditori.
export const DEFAULT_ROLE = 'venditore';
