import type { FinancesCommandInput } from '../commands';
import { addDays, formatDate } from '../dates';
import { sum } from '../money';
import { buildPieces } from '../recouvrement/pieces';
import { transmissionStatut } from '../recouvrement/transmissions';
import type { Dossier, FinancesData, Liasse, Transmission } from '../schemas';
import { fail, find } from './context';
import type { Outcome, ReducerContext } from './context';

export function generateLiasse(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'generateLiasse'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  const pieces = buildPieces(data, dossier);
  for (const id of cmd.exclues) {
    const piece = pieces.find((item) => item.id === id);
    if (!piece) fail('Pièce introuvable : la liste a changé, rechargez le dossier.');
    if (!piece.facultative) fail(`La pièce « ${piece.libelle} » est obligatoire.`);
  }
  const retenues = pieces.filter((piece) => !cmd.exclues.includes(piece.id));
  const liasse: Liasse = { id: ctx.id('lia'), genereLe: data.today, pieces: retenues, octets: sum(retenues.map((piece) => piece.octets)), empreinte: '' };
  dossier.liasses.push(liasse);
  return { message: `Envoi généré : ${String(retenues.length)} pièces figées dans le dossier ${dossier.numero}.`, id: liasse.id };
}

function pushTransmission(
  data: FinancesData,
  ctx: ReducerContext,
  dossier: Dossier,
  liasse: Liasse,
  recipient: Pick<Transmission, 'destinataireId' | 'destinataire' | 'email' | 'dureeJours' | 'message'>,
): Transmission {
  const transmission: Transmission = {
    id: ctx.id('trm'),
    liasseId: liasse.id,
    ...recipient,
    envoyeLe: data.today,
    expireLe: addDays(data.today, recipient.dureeJours),
    revoqueLe: null,
    telechargements: 0,
  };
  dossier.transmissions.push(transmission);
  dossier.actes.push({
    id: ctx.id('acte'),
    date: data.today,
    kind: 'transmission',
    libelle: `Pièces transmises par lien sécurisé (${String(liasse.pieces.length)} pièces, valable jusqu’au ${formatDate(transmission.expireLe)})`,
    intervenant: transmission.destinataire,
    cout: 0,
    factureId: null,
  });
  return transmission;
}

function pushRevocation(data: FinancesData, ctx: ReducerContext, dossier: Dossier, transmission: Transmission): void {
  transmission.revoqueLe = data.today;
  dossier.actes.push({
    id: ctx.id('acte'),
    date: data.today,
    kind: 'revocation',
    libelle: `Lien révoqué (pièces transmises le ${formatDate(transmission.envoyeLe)})`,
    intervenant: transmission.destinataire,
    cout: 0,
    factureId: null,
  });
}

export function transmitLiasse(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'transmitLiasse'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  if (dossier.liasses.length === 0) fail('Générez l’envoi des pièces avant de le transmettre.');
  const liasse = find(dossier.liasses, cmd.liasseId, 'Envoi');
  const transmission = pushTransmission(data, ctx, dossier, liasse, {
    destinataireId: cmd.destinataireId,
    destinataire: cmd.destinataire,
    email: cmd.email,
    dureeJours: cmd.dureeJours,
    message: cmd.message,
  });
  return { message: `Lien envoyé à ${transmission.destinataire}, valable jusqu’au ${formatDate(transmission.expireLe)}.`, id: transmission.id };
}

export function revokeTransmission(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'revokeTransmission'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  const transmission = find(dossier.transmissions, cmd.transmissionId, 'Envoi');
  const statut = transmissionStatut(transmission, data.today);
  if (statut === 'revoque') fail('Ce lien est déjà révoqué.');
  if (statut === 'expire') fail('Ce lien a déjà expiré.');
  pushRevocation(data, ctx, dossier, transmission);
  return { message: `Lien révoqué : ${transmission.destinataire} ne peut plus télécharger les pièces.`, id: transmission.id };
}

export function resendTransmission(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'resendTransmission'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  const previous = find(dossier.transmissions, cmd.transmissionId, 'Envoi');
  const liasse = find(dossier.liasses, previous.liasseId, 'Envoi');
  if (transmissionStatut(previous, data.today) === 'actif') pushRevocation(data, ctx, dossier, previous);
  const transmission = pushTransmission(data, ctx, dossier, liasse, {
    destinataireId: previous.destinataireId,
    destinataire: previous.destinataire,
    email: previous.email,
    dureeJours: previous.dureeJours,
    message: previous.message,
  });
  return { message: `Nouveau lien envoyé à ${transmission.destinataire}, valable jusqu’au ${formatDate(transmission.expireLe)}.`, id: transmission.id };
}
