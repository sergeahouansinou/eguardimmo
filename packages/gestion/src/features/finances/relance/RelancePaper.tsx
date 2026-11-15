import type { LivreLine } from '../grandLivre';
import { formatDate } from '../dates';

export interface LetterProps {
  brand: string;
  brandAddress: string;
  email: string;
  today: string;
  locataire: string;
  bien: string;
  objet: string;
  corps: string;
  libelle: string;
  appele: string;
  paye: string;
  reste: string;
  piece: boolean;
  pages: number;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function LetterPage({ brand, brandAddress, email, today, locataire, bien, objet, corps, libelle, appele, paye, reste, piece, pages }: LetterProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-body-strong">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-md bg-action text-caption text-on-action">{initials(brand)}</span>
            {brand}
          </span>
          <span className="text-caption text-fg-subtle">{brandAddress}</span>
          <span className="text-caption text-fg-subtle">{email}</span>
        </div>
        <span className="text-caption text-fg-subtle">Paris, le {formatDate(today)}</span>
      </div>
      <div className="ml-auto flex w-52 flex-col">
        <b className="text-body-strong">{locataire}</b>
        <span className="text-body">{bien}</span>
      </div>
      <p className="text-body"><b className="font-semibold">Objet :</b> {objet}</p>
      <p className="text-body">Madame, Monsieur,</p>
      {corps.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line text-body">{paragraph}</p>
      ))}
      <table aria-label="Détail de la somme due" className="w-full border-collapse text-body">
        <thead>
          <tr>
            <th scope="col" className="border-b border-fg py-1 text-left text-caption font-semibold text-fg-subtle">Échéance</th>
            <th scope="col" className="border-b border-fg py-1 text-right text-caption font-semibold text-fg-subtle">Appelé</th>
            <th scope="col" className="border-b border-fg py-1 text-right text-caption font-semibold text-fg-subtle">Payé</th>
            <th scope="col" className="border-b border-fg py-1 text-right text-caption font-semibold text-fg-subtle">Reste dû</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="py-1">{libelle}</td>
            <td className="py-1 text-right tabular-nums">{appele}</td>
            <td className="py-1 text-right tabular-nums">{paye}</td>
            <td className="py-1 text-right tabular-nums">{reste}</td>
          </tr>
          <tr className="font-bold">
            <td className="border-t border-fg py-1">Total</td>
            <td className="border-t border-fg py-1 text-right tabular-nums">{appele}</td>
            <td className="border-t border-fg py-1 text-right tabular-nums">{paye}</td>
            <td className="border-t border-fg py-1 text-right tabular-nums">{reste}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-body">Veuillez agréer, Madame, Monsieur, nos salutations distinguées.</p>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="h-9 w-40 border-b border-fg" />
        <span className="text-caption text-fg-subtle">{brand}</span>
      </div>
      {piece ? <p className="text-caption text-fg-subtle">Pièce jointe : grand livre du locataire, 1 page.</p> : null}
      <div className="mt-auto flex justify-between border-t border-line pt-2 text-caption text-fg-subtle">
        <span>eGuardImmo, relance de loyer</span>
        <span>Page 1 sur {pages}</span>
      </div>
    </>
  );
}

const LEDGER_ROWS = 14;

export function LedgerSheet({ locataire, lignes, solde, money, today }: { locataire: string; lignes: readonly LivreLine[]; solde: number; money: (minor: number) => string; today: string }) {
  const shown = lignes.slice(-LEDGER_ROWS);
  const hidden = lignes.length - shown.length;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <b className="text-block-title">Grand livre du locataire</b>
          <span className="text-body">{locataire}</span>
        </div>
        <span className="text-caption text-fg-subtle">Arrêté au {formatDate(today)}</span>
      </div>
      <table aria-label="Grand livre joint" className="w-full border-collapse text-caption">
        <thead>
          <tr>
            <th scope="col" className="border-b border-fg py-1 text-left font-semibold text-fg-subtle">Date</th>
            <th scope="col" className="border-b border-fg py-1 text-left font-semibold text-fg-subtle">Libellé</th>
            <th scope="col" className="border-b border-fg py-1 text-right font-semibold text-fg-subtle">Débit</th>
            <th scope="col" className="border-b border-fg py-1 text-right font-semibold text-fg-subtle">Crédit</th>
            <th scope="col" className="border-b border-fg py-1 text-right font-semibold text-fg-subtle">Solde</th>
          </tr>
        </thead>
        <tbody>
          {hidden > 0 ? (
            <tr className="bg-muted">
              <td colSpan={5} className="py-1 text-center text-fg-subtle">{hidden} écriture{hidden > 1 ? 's' : ''} antérieure{hidden > 1 ? 's' : ''} non reprise{hidden > 1 ? 's' : ''}</td>
            </tr>
          ) : null}
          {shown.map((ligne) => (
            <tr key={ligne.id} className="border-b border-line">
              <td className="py-1 pr-2 whitespace-nowrap">{formatDate(ligne.date)}</td>
              <td className="py-1 pr-2">{ligne.libelle}</td>
              <td className="py-1 text-right tabular-nums">{ligne.debit === 0 ? '' : money(ligne.debit)}</td>
              <td className="py-1 text-right tabular-nums">{ligne.credit === 0 ? '' : money(ligne.credit)}</td>
              <td className="py-1 text-right tabular-nums">{money(ligne.solde)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={4} className="border-t border-fg py-1 text-right">Solde dû</td>
            <td className="border-t border-fg py-1 text-right tabular-nums">{money(solde)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-auto flex justify-between border-t border-line pt-2 text-caption text-fg-subtle">
        <span>eGuardImmo, relance de loyer</span>
        <span>Page 2 sur 2</span>
      </div>
    </>
  );
}
