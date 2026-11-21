<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Maintenance\PublicApi\OwnerApprovals;
use App\Modules\Mandates\Data\MandateCoverageData;
use App\Modules\Mandates\Data\OwnerCoverageData;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Months;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Accueil du mandant pour un couple (agence, mandant) : mandat, mois en cours, reversements, dernier compte rendu, compteurs et lots.
 * Chaque chiffre vient de la même source que l'écran dédié (`OwnerRent`, `OwnerPayouts`, `OwnerReports`) ; rien n'est recalculé ici.
 * La portée reçue ne contient qu'un seul couple (`OwnerSelection`).
 */
final readonly class OwnerHome
{
    public function __construct(
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private MandateDirectory $mandats,
        private OwnerRent $loyers,
        private OwnerPayouts $reversements,
        private OwnerReports $rapports,
        private OwnerApprovals $devis,
        private OwnerHomeUnits $lots,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function of(OwnerScopeData $portee, CarbonImmutable $jour): array
    {
        $visible = $portee->visibles[0];
        [$mois, $debut, $fin] = Months::bounds(null, $jour);
        $loyers = $this->loyers->month($portee, $debut, $fin)[0];
        $encaisse = [];

        foreach ($loyers['units'] as $ligne) {
            $encaisse[$ligne['unit']->id] = $ligne['amounts']['collected'];
        }

        $lotIds = $this->lotsDuJour($portee, $visible, $jour);
        $dernier = $this->rapports->page($portee, 1, null)->items()[0] ?? null;
        $coIndivisaire = $visible->role === OwnerAccessRole::CoOwner;

        return $this->contexte->run($visible->organizationId, function () use ($portee, $visible, $jour, $mois, $debut, $fin, $loyers, $encaisse, $lotIds, $dernier, $coIndivisaire): array {
            $devise = $this->organisations->currency();
            $detail = $this->lots->of($lotIds, $encaisse, $devise, $jour);
            $mandat = $this->mandat($visible, $lotIds, $jour);

            return [
                'agency' => ['id' => $visible->organizationId, 'name' => $this->organisations->names([$visible->organizationId])[$visible->organizationId] ?? null],
                'mandant' => ['name' => $visible->mandantName, 'role' => $visible->role->value],
                'access' => ['in_grace' => $visible->inGrace, 'until' => $visible->accessUntil?->toDateString()],
                'currency' => $devise->getCode(),
                'mandate' => $mandat['mandate'],
                'mandates_count' => $mandat['count'],
                'month' => [
                    'period' => $mois,
                    'from' => $debut->toDateString(),
                    'to' => $fin->toDateString(),
                    'called' => $loyers['totals']['called'],
                    'collected' => $loyers['totals']['collected'],
                    'arrears' => $detail['arrears'],
                ],
                'payouts' => $coIndivisaire ? null : $this->versements($portee, $visible, $jour),
                'last_report' => $dernier === null ? null : $this->compteRendu($dernier),
                'counters' => [
                    'units_total' => count($detail['units']),
                    'units_occupied' => $detail['occupied'],
                    'units_vacant' => count($detail['units']) - $detail['occupied'],
                    'quotes_to_decide' => $this->devis->pendingCount($portee),
                ],
                'units' => $detail['units'],
            ];
        });
    }

    /**
     * @return list<string>
     */
    private function lotsDuJour(OwnerScopeData $portee, OwnerVisibleData $visible, CarbonImmutable $jour): array
    {
        $date = $jour->toDateString();
        $lots = array_map(
            fn (OwnerCoverageData $c): string => $c->unitId,
            array_filter($portee->coveragesOf($visible->organizationId), fn (OwnerCoverageData $c): bool => $c->mandantPartyId === $visible->mandantPartyId && $c->from <= $date && $c->to >= $date),
        );

        return array_values(array_unique($lots));
    }

    /**
     * Le mandat qui couvre le plus de lots aujourd'hui (à égalité, la plus petite référence) ; les autres ne sont que comptés.
     *
     * @param  list<string>  $lotIds
     * @return array{mandate: array<string, mixed>|null, count: int}
     */
    private function mandat(OwnerVisibleData $visible, array $lotIds, CarbonImmutable $jour): array
    {
        $parMandat = [];

        foreach ($this->mandats->coveringUnits($lotIds, $jour) as $couverture) {
            if ($couverture->mandantPartyId === $visible->mandantPartyId) {
                $parMandat[$couverture->mandateId][] = $couverture;
            }
        }

        if ($parMandat === []) {
            return ['mandate' => null, 'count' => 0];
        }

        uasort($parMandat, fn (array $a, array $b): int => [count($b), $a[0]->reference] <=> [count($a), $b[0]->reference]);
        $couvertures = array_values($parMandat)[0];
        /** @var MandateCoverageData $c */
        $c = $couvertures[0];
        $devise = $c->currency;

        return ['count' => count($parMandat), 'mandate' => [
            'id' => $c->mandateId,
            'reference' => $c->reference,
            'status' => $c->status->value,
            'is_suspended' => $c->isSuspended,
            'starts_on' => $c->startsOn,
            'end_date' => $this->mandats->find($c->mandateId)->endDate,
            'fee_kind' => $c->feeKind->value,
            'fee_basis_points' => $c->feeBasisPoints,
            'fee_flat_amount' => $c->feeFlatAmount === null ? null : ['amount' => $c->feeFlatAmount, 'currency' => $devise],
            'payout_day' => $c->payoutDay,
        ]];
    }

    /**
     * @return array<string, mixed>
     */
    private function versements(OwnerScopeData $portee, OwnerVisibleData $visible, CarbonImmutable $jour): array
    {
        $resume = $this->reversements->summary($visible);
        $prochain = $this->reversements->next($portee, $jour)[0] ?? null;

        return [...$resume, 'next_date' => $prochain['date'] ?? null, 'next_notice' => $prochain['notice'] ?? null];
    }

    /**
     * @return array<string, mixed>
     */
    private function compteRendu(ManagementReport $rapport): array
    {
        return [
            'id' => $rapport->id,
            'number' => $rapport->number,
            'status' => $rapport->status->value,
            'period' => ['kind' => $rapport->period_kind->value, 'start' => $rapport->period_start->toDateString(), 'end' => $rapport->period()->to->toDateString()],
            'published_at' => $rapport->published_at?->toIso8601String(),
            'first_read_at' => $rapport->first_read_at?->toIso8601String(),
            'is_read' => $rapport->first_read_at !== null,
        ];
    }
}
