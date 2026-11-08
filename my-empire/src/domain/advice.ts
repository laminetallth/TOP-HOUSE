import type { HabitArea, Schedule } from './types.js';

/** Buone abitudini consigliate: si aggiungono con un tocco e restano modificabili. */
export interface Advice {
  id: string;
  name: string;
  icon: string;
  area: HabitArea;
  schedule: Schedule;
  reminder?: string;
  why: string;
  how: string;
}

export const ADVICE: Advice[] = [
  { id: 'acqua', name: 'Bere 2 litri d\'acqua', icon: 'drop', area: 'corpo', schedule: { type: 'daily' }, why: 'Con basket e palestra perdi molti liquidi: idratarti aiuta resistenza e recupero, e la creatina lavora meglio.', how: 'Tieni una borraccia da 1 litro e riempila due volte.' },
  { id: 'sonno', name: 'A letto entro le 23:30', icon: 'moon', area: 'corpo', schedule: { type: 'daily' }, reminder: '23:00', why: 'Il sonno è quando i muscoli recuperano e la mente fissa quello che hai imparato.', how: 'Promemoria alle 23:00: telefono in carica lontano dal letto.' },
  { id: 'stretching', name: 'Mobilità e stretching 10 minuti', icon: 'spark', area: 'sport', schedule: { type: 'days', days: [2, 4, 6] }, why: 'Nei giorni senza basket riduce rigidità e rischio di infortuni a caviglie e ginocchia.', how: '10 minuti dopo la doccia: anche, caviglie, spalle.' },
  { id: 'pianifica', name: 'Pianificare domani (2 minuti)', icon: 'calendar', area: 'mente', schedule: { type: 'daily' }, reminder: '21:30', why: 'Chi decide la sera le 3 priorità di domani parte la mattina senza perdere tempo.', how: 'Apri il calendario di domani e scrivi le 3 cose più importanti.' },
  { id: 'gratitudine', name: '3 cose positive della giornata', icon: 'star', area: 'mente', schedule: { type: 'daily' }, why: 'Allena l\'attenzione su ciò che funziona: si abbina bene alle dichiarazioni.', how: 'Prima di dormire, nella nota del giorno.' },
  { id: 'mattino', name: 'Primi 15 minuti senza telefono', icon: 'sun', area: 'mente', schedule: { type: 'daily' }, why: 'Iniziare con le tue priorità invece che con le notifiche degli altri.', how: 'Prima dichiarazioni, acqua e creatina; poi il telefono.' },
  { id: 'camminata', name: 'Camminata di 20 minuti', icon: 'walk', area: 'corpo', schedule: { type: 'days', days: [2, 4, 7] }, why: 'Movimento leggero nei giorni di riposo: aiuta recupero e testa libera.', how: 'Ottima insieme all\'audiolibro: due abitudini in una.' },
  { id: 'proteine', name: 'Proteine a ogni pasto', icon: 'food', area: 'nutrizione', schedule: { type: 'daily' }, why: 'Sostiene i progressi in palestra e ti tiene sazio più a lungo.', how: 'Ad ogni pasto una fonte: uova, carne, pesce, legumi, yogurt.' },
  { id: 'chiamata', name: 'Sentire un amico o un familiare', icon: 'heart', area: 'famiglia', schedule: { type: 'weekly', timesPerWeek: 1 }, why: 'Le relazioni sono una delle basi più solide del benessere.', how: 'Una telefonata a settimana, anche breve.' },
  { id: 'ordine', name: 'Riordinare 10 minuti', icon: 'home', area: 'casa', schedule: { type: 'daily' }, why: 'Spazio ordinato, testa più leggera; evita che si accumuli per il weekend.', how: 'Timer da 10 minuti la sera, poi stop.' },
];
