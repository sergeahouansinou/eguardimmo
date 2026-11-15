'use client';

import { Download, Pencil, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Icon, Select, Switch, Textarea } from '@eguardimmo/ui';
import { z } from 'zod';
import { formatDate } from '../dates';
import { bailOf, resteDu } from '../derive';
import { DocumentViewer, KeyValues, SideCard } from '../documents/Viewer';
import { grandLivreOf } from '../grandLivre';
import { CommandAlert, FINANCES_ROUTES, NotFoundBlock, PageHeader, QueryGate, useExec, useMoney } from '../parts';
import type { ScreenProps } from '../parts';
import { financesPaths } from '../paths';
import { newRequestKey, useFinances } from '../queries';
import type { FinancesData } from '../schemas';
import { LedgerSheet, LetterPage } from './RelancePaper';
import { MODELES, NIVEAUX, NIVEAU_LABELS, modeleById, modelesOf, relanceContext, suggestedNiveau, tenantEmail } from './templates';
import type { Niveau } from './templates';

const texteSchema = z.string().trim().min(20, 'Le texte doit comporter au moins 20 caractères.').max(4000, 'Le texte est limité à 4 000 caractères.');

const CANAL_LABELS = { email: 'E-mail et portail', courrier: 'Courrier postal', recommande: 'Lettre recommandée avec AR' } as const;
const HISTORY_LABELS = { email: 'Relance par e-mail', courrier: 'Relance par courrier', recommande: 'Lettre recommandée' } as const;

const isNiveau = (value: string | null | undefined): value is Niveau => NIVEAUX.some((item) => item === value);

export function RelancePage({ Link, navigate, echeanceId, niveau = null }: ScreenProps & { echeanceId: string; niveau?: string | null }) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="La relance n’a pas pu être préparée">
      {(data) => {
        const echeance = data.echeances.find((item) => item.id === echeanceId);
        const bail = echeance ? bailOf(data, echeance.bailId) : undefined;
        if (!echeance || !bail) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés', href: FINANCES_ROUTES.impayes }, { label: 'Relance' }]} title="Relance" />
              <NotFoundBlock Link={Link} title="Impayé introuvable" backHref={FINANCES_ROUTES.impayes} backLabel="Retour aux impayés" />
            </>
          );
        }
        return <RelanceContent data={data} echeanceId={echeanceId} initial={isNiveau(niveau) ? niveau : suggestedNiveau(data, echeance)} Link={Link} navigate={navigate} />;
      }}
    </QueryGate>
  );
}

function RelanceContent({ data, echeanceId, initial, Link, navigate }: ScreenProps & { data: FinancesData; echeanceId: string; initial: Niveau }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const requestKey = useRef(newRequestKey());
  const [niveau, setNiveau] = useState<Niveau>(initial);
  const [modeleId, setModeleId] = useState(() => modelesOf(initial)[0]?.id ?? MODELES[0]?.id ?? '');
  const [edited, setEdited] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [joindre, setJoindre] = useState(true);
  const [recommande, setRecommande] = useState(initial === 'mise_en_demeure');
  const echeance = data.echeances.find((item) => item.id === echeanceId);
  const bail = echeance ? bailOf(data, echeance.bailId) : undefined;
  const modele = modeleById(modeleId) ?? modelesOf(niveau)[0] ?? MODELES[0];
  if (!echeance || !bail || !modele) return null;

  const context = relanceContext(data, echeance, bail);
  const corps = edited ?? modele.corps(context);
  const reste = resteDu(echeance);
  const soldee = reste <= 0;
  const canal = recommande ? 'recommande' : niveau === 'mise_en_demeure' ? 'courrier' : 'email';
  const book = grandLivreOf(data, bail.locataireId);
  const previous = data.relances.filter((relance) => relance.echeanceId === echeanceId).sort((a, b) => b.date.localeCompare(a.date));
  const attachment = joindre && book !== undefined;
  const letter = (
    <LetterPage
      brand={data.workspace.nom}
      brandAddress={data.workspace.adresse}
      email="gestion@les-tilleuls.example"
      today={data.today}
      locataire={bail.locataire}
      bien={context.bien}
      objet={modele.objet(context)}
      corps={corps}
      libelle={echeance.libelle}
      appele={money(echeance.montant)}
      paye={money(echeance.paye)}
      reste={money(reste)}
      piece={attachment}
      pages={attachment ? 2 : 1}
    />
  );
  const pages = book && attachment ? [letter, <LedgerSheet key="livre" locataire={book.locataire} lignes={book.lignes} solde={book.solde} money={money} today={data.today} />] : [letter];

  const chooseNiveau = (value: string) => {
    if (!isNiveau(value)) return;
    setNiveau(value);
    setModeleId(modelesOf(value)[0]?.id ?? modeleId);
    setEdited(null);
    setError(undefined);
    setRecommande(value === 'mise_en_demeure');
  };
  const chooseModele = (value: string) => {
    setModeleId(value);
    setEdited(null);
    setError(undefined);
  };
  const send = () => {
    const parsed = texteSchema.safeParse(corps);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      setEditing(true);
      return;
    }
    exec.run(
      { type: 'sendRelance', echeanceId, niveau, modele: modele.label, canal, joindreGrandLivre: attachment, texte: parsed.data },
      { requestKey: requestKey.current, redirect: financesPaths.impaye(echeanceId) },
    );
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[
          { label: 'Finances', href: FINANCES_ROUTES.operations },
          { label: 'Impayés', href: FINANCES_ROUTES.impayes },
          { label: `Relance de ${bail.locataire}`, href: financesPaths.impaye(echeanceId) },
          { label: 'Aperçu' },
        ]}
        title={`Relance du ${formatDate(data.today)}`}
        description={attachment ? 'Vérifiez le courrier avant l’envoi. Le grand livre est joint en page 2.' : 'Vérifiez le courrier avant l’envoi.'}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setEditing((current) => !current); }}>
              <Icon icon={Pencil} />
              {editing ? 'Terminer la modification' : 'Modifier le texte'}
            </Button>
            <Button variant="secondary" onClick={() => { window.print(); }}>
              <Icon icon={Download} />
              Télécharger
            </Button>
            <Button loading={exec.pending} disabled={soldee} onClick={send}>
              <Icon icon={Send} />
              Envoyer la relance
            </Button>
          </>
        }
      />
      <CommandAlert error={exec.error} />
      {soldee ? (
        <Alert tone="info" title="Cette échéance est soldée">
          Il n’y a plus rien à relancer : l’envoi est désactivé.
        </Alert>
      ) : null}
      <DocumentViewer
        title="Aperçu de la relance"
        pages={pages}
        side={
          <>
            {editing ? (
              <SideCard title="Texte de la relance">
                <Textarea
                  label="Corps du courrier"
                  placeholder="Sauf erreur de notre part, le loyer n’a pas été réglé…"
                  rows={10}
                  value={corps}
                  error={error}
                  onChange={(event) => { setEdited(event.target.value); setError(undefined); }}
                />
                <Button variant="link" size="sm" disabled={edited === null} onClick={() => { setEdited(null); setError(undefined); }}>
                  Rétablir le texte du modèle
                </Button>
              </SideCard>
            ) : null}
            <SideCard title="Envoi">
              <KeyValues
                items={[
                  ['Destinataire', bail.locataire],
                  ['Adresse', tenantEmail(bail.locataire)],
                  ['Canal', CANAL_LABELS[canal]],
                  ['Modèle', modele.label],
                ]}
              />
              <Select label="Niveau" placeholder="Choisissez un niveau" options={NIVEAUX.map((value) => ({ value, label: NIVEAU_LABELS[value] }))} value={niveau} onValueChange={chooseNiveau} />
              <Select label="Modèle" placeholder="Choisissez un modèle" options={modelesOf(niveau).map((item) => ({ value: item.id, label: item.label }))} value={modele.id} onValueChange={chooseModele} />
            </SideCard>
            <SideCard title="Options">
              <Switch label="Joindre le grand livre" checked={joindre} onCheckedChange={setJoindre} />
              <Switch label="Lettre recommandée" checked={recommande} onCheckedChange={setRecommande} />
              <p className="text-caption text-fg-subtle">
                {canal === 'email' ? 'Aucun frais : envoi par e-mail et dans l’espace du locataire.' : canal === 'courrier' ? 'Frais de courrier : 15 €, consignés au carnet du dossier.' : 'Frais de recommandé : 6,20 €, consignés au carnet du dossier.'}
              </p>
            </SideCard>
            <SideCard title="Relances précédentes">
              {previous.length === 0 ? (
                <p className="text-body text-fg-muted">Aucune relance n’a encore été envoyée.</p>
              ) : (
                <ul className="flex flex-col">
                  {previous.map((relance) => (
                    <li key={relance.id} className="flex items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                      <span className="text-body text-fg-muted">{HISTORY_LABELS[relance.canal]}</span>
                      <b className="text-body">{formatDate(relance.date)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </SideCard>
          </>
        }
      />
    </>
  );
}
