<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Notifications\Data\AudienceMember;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Support\FrenchDates;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonImmutable;

/**
 * Audience d'une diffusion, calculée ici à partir de l'organisation courante : jamais une liste fournie par le client. Locataires des
 * baux signés en cours, ou mandants d'un mandat actif ; une fiche n'apparaît qu'une fois, avec son premier bail ou mandat.
 */
final readonly class CampaignAudiences
{
    private const int PAGE = 200;

    public function __construct(
        private LeaseSchedule $planning,
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private UnitDirectory $lots,
        private PartyDirectory $parties,
        private PartyLinks $liens,
        private MandateDirectory $mandats,
        private OwnerLinks $proprietaires,
    ) {}

    /**
     * @param  list<string>  $buildingIds  vide : tous les immeubles (locataires seulement)
     * @return list<AudienceMember>
     */
    public function members(CampaignAudience $audience, array $buildingIds, CarbonImmutable $aujourdhui): array
    {
        $membres = [];

        foreach ($this->rows($audience, $aujourdhui) as $membre) {
            if ($buildingIds !== [] && ! in_array($membre->propertyId, $buildingIds, true)) {
                continue;
            }

            $membres[$membre->partyId] ??= $membre;
        }

        return array_values($membres);
    }

    /**
     * Pour l'écran de composition : une fiche locataire compte dans chaque immeuble où elle a un bail.
     *
     * @return array{count: int, without_email: int, buildings: list<array{id: string, name: string, count: int, without_email: int}>}
     */
    public function tenantSummary(CarbonImmutable $aujourdhui): array
    {
        $resume = ['count' => 0, 'without_email' => 0, 'buildings' => []];
        $vus = [];
        $parImmeuble = [];

        foreach ($this->tenantRows($aujourdhui) as $membre) {
            $cle = (string) $membre->propertyId;
            $parImmeuble[$cle] ??= ['id' => $cle, 'name' => (string) $membre->propertyName, 'parties' => []];
            $parImmeuble[$cle]['parties'][$membre->partyId] = $membre->email === null;

            if (! isset($vus[$membre->partyId])) {
                $vus[$membre->partyId] = true;
                $resume['count']++;
                $resume['without_email'] += $membre->email === null ? 1 : 0;
            }
        }

        $resume['buildings'] = array_values(array_map(fn (array $immeuble): array => [
            'id' => $immeuble['id'],
            'name' => $immeuble['name'],
            'count' => count($immeuble['parties']),
            'without_email' => count(array_filter($immeuble['parties'])),
        ], $parImmeuble));
        usort($resume['buildings'], fn (array $a, array $b): int => [$a['name'], $a['id']] <=> [$b['name'], $b['id']]);

        return $resume;
    }

    /**
     * @return array{count: int, without_email: int}
     */
    public function mandantSummary(CarbonImmutable $aujourdhui): array
    {
        $resume = ['count' => 0, 'without_email' => 0];

        foreach ($this->mandantRows($aujourdhui) as $membre) {
            $resume['count']++;
            $resume['without_email'] += $membre->email === null ? 1 : 0;
        }

        return $resume;
    }

    /**
     * @return iterable<AudienceMember>
     */
    private function rows(CampaignAudience $audience, CarbonImmutable $aujourdhui): iterable
    {
        return $audience === CampaignAudience::Tenants ? $this->tenantRows($aujourdhui) : $this->mandantRows($aujourdhui);
    }

    /**
     * @return iterable<AudienceMember>
     */
    private function tenantRows(CarbonImmutable $aujourdhui): iterable
    {
        $apres = null;

        do {
            $facturations = $this->planning->activeBetween($aujourdhui, $aujourdhui, $apres, self::PAGE);

            if ($facturations === []) {
                return;
            }

            $apres = $facturations[array_key_last($facturations)]->leaseId;
            $ids = array_map(fn ($ligne): string => $ligne->leaseId, $facturations);
            $baux = [];

            foreach ($this->baux->findMany($ids) as $bail) {
                $baux[$bail->id] = $bail;
            }

            $locataires = $this->participants->tenantsAtMany($ids, $aujourdhui);
            $lotIds = array_values(array_unique(array_filter(array_map(fn ($bail): ?string => $bail->units[0]->unitId ?? null, $baux))));
            $lots = $this->lots->findMany($lotIds);
            $partieIds = array_values(array_unique(array_merge(...array_map(fn (array $lignes): array => array_map(fn ($ligne): string => $ligne->partyId, $lignes), array_values($locataires) ?: [[]]))));
            $fiches = $this->parties->findMany($partieIds);
            $comptes = $this->liens->accountsOf($partieIds);

            foreach ($facturations as $facturation) {
                $bail = $baux[$facturation->leaseId] ?? null;
                $lot = $bail === null || ! isset($bail->units[0]) ? null : ($lots[$bail->units[0]->unitId] ?? null);

                foreach ($locataires[$facturation->leaseId] ?? [] as $ligne) {
                    $fiche = $fiches[$ligne->partyId];

                    yield new AudienceMember(
                        $fiche->id,
                        $fiche->isAnonymized ? null : $fiche->primaryEmail,
                        $comptes[$fiche->id] ?? null,
                        $facturation->leaseId,
                        $lot?->propertyId,
                        $lot?->propertyName,
                        [
                            'Prénom' => $this->firstName($fiche),
                            'Bien' => $lot === null ? '' : $lot->propertyName.' – '.$lot->reference,
                            'Mois' => FrenchDates::monthYear($aujourdhui),
                            'Échéance' => $this->nextDue($facturation->dueDay, $aujourdhui),
                        ],
                    );
                }
            }
        } while (count($facturations) === self::PAGE);
    }

    /**
     * @return iterable<AudienceMember>
     */
    private function mandantRows(CarbonImmutable $aujourdhui): iterable
    {
        $apres = null;

        do {
            $mandants = $this->mandats->activeMandants($apres, self::PAGE);

            if ($mandants === []) {
                return;
            }

            $apres = $mandants[array_key_last($mandants)]->partyId;
            $partieIds = array_map(fn ($ligne): string => $ligne->partyId, $mandants);
            $fiches = $this->parties->findMany($partieIds);
            $comptes = $this->proprietaires->accountsOfMandants($partieIds, [OwnerAccessRole::Holder, OwnerAccessRole::Representative]);

            foreach ($mandants as $mandant) {
                $fiche = $fiches[$mandant->partyId];

                yield new AudienceMember(
                    $fiche->id,
                    $fiche->isAnonymized ? null : $fiche->primaryEmail,
                    ($comptes[$fiche->id] ?? [])[0] ?? null,
                    null,
                    null,
                    null,
                    [
                        'Prénom' => $this->firstName($fiche),
                        'Mandat' => $mandant->mandateReference,
                        'Mois' => FrenchDates::monthYear($aujourdhui),
                    ],
                );
            }
        } while (count($mandants) === self::PAGE);
    }

    private function firstName(PartyData $fiche): string
    {
        return $fiche->firstName ?? $fiche->displayName;
    }

    private function nextDue(int $jour, CarbonImmutable $aujourdhui): string
    {
        $ce = $aujourdhui->startOfMonth()->addDays(min($jour, $aujourdhui->daysInMonth) - 1);
        $date = $ce->lessThan($aujourdhui) ? $aujourdhui->startOfMonth()->addMonthNoOverflow()->addDays(min($jour, $aujourdhui->addMonthNoOverflow()->daysInMonth) - 1) : $ce;
        $numero = $date->day === 1 ? '1er' : (string) $date->day;

        return $numero.' '.FrenchDates::monthYear($date);
    }
}
