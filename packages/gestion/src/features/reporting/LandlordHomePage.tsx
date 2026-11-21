'use client';

import { StatCard } from '@eguardimmo/ui';
import { DoorOpen, FileClock, ShieldCheck, Wrench } from 'lucide-react';
import { useShellData } from '@eguardimmo/shell';
import { AgingPanel, ArrearsStat, RentCollectedStat, StatSlot } from './HomeCards';
import { useLandlordHome } from './hooks';
import { plural } from './labels';
import { reportingPaths } from './paths';
import { SectionCard, useGestionNavigation } from '../locataires/kit';

export function LandlordHomePage() {
  const { Link } = useGestionNavigation();
  const shell = useShellData();
  const home = useLandlordHome();
  const firstName = shell.data?.user.firstName;
  const data = home.data;

  return (
    <>
      <div>
        <h1 className="text-page-title">{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</h1>
        <p className="mt-0.5 text-body text-fg-muted">{shell.data?.workspace.name ?? ' '}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatSlot label="Loyers encaissés" query={home} failure="Les loyers du mois n’ont pas pu être chargés">
          {data ? <RentCollectedStat card={data} /> : null}
        </StatSlot>
        <ArrearsStat />
        <StatSlot label="Lots vacants" query={home} failure="Les lots vacants n’ont pas pu être chargés">
          {data ? (
            <StatCard label="Lots vacants" icon={DoorOpen} value={String(data.vacantUnits)}>
              <span className="text-caption text-fg-subtle"><Link href={reportingPaths.units} className="hover:underline">Voir les biens</Link></span>
            </StatCard>
          ) : null}
        </StatSlot>
        <StatSlot label="Baux arrivant à échéance" query={home} failure="Les baux à échéance n’ont pas pu être chargés">
          {data ? (
            <StatCard label="Baux arrivant à échéance" icon={FileClock} value={String(data.leasesEnding)}>
              <span className="text-caption text-fg-subtle"><Link href={reportingPaths.leases} className="hover:underline">Voir les baux</Link></span>
            </StatCard>
          ) : null}
        </StatSlot>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard id="accueil-impayes" title="Impayés par ancienneté" aside={<Link href={reportingPaths.arrears} className="text-caption text-action-on-subtle hover:underline">Impayés et recouvrement</Link>}>
          <AgingPanel />
        </SectionCard>
        <SectionCard id="accueil-suivi" title="À suivre">
          <StatSlot label="À suivre" query={home} failure="Le suivi n’a pas pu être chargé">
            {data ? (
              <ul className="flex flex-col gap-1.5 text-body text-fg">
                <li className="flex items-center gap-2"><Wrench aria-hidden="true" className="size-4 text-fg-subtle" />{plural(data.openInterventions, 'intervention ouverte', 'interventions ouvertes')}</li>
                <li className="flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="size-4 text-fg-subtle" />
                  <Link href={reportingPaths.conformity} className="hover:underline">{plural(data.certificatesToRenew, 'pièce de conformité à renouveler', 'pièces de conformité à renouveler')}</Link>
                </li>
              </ul>
            ) : null}
          </StatSlot>
        </SectionCard>
      </div>
    </>
  );
}
