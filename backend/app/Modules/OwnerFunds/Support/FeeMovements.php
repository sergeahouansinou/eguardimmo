<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\Data\CollectionMovementData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Mandates\Data\MandateFeeScheduleData;
use App\Modules\Mandates\Data\MandateFeeTermData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\OwnerFunds\Data\FeeSegmentData;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Encaissements imputés d'un mandant sur une période, rattachés à leur mandat puis à leur barème (ADR 0031, décision 3).
 */
final readonly class FeeMovements
{
    public function __construct(
        private LedgerAggregates $agregats,
        private MandateDirectory $mandats,
    ) {}

    /**
     * @return list<MandateFeeScheduleData> mandats du mandant commencés au plus tard à `$jusquau`
     */
    public function schedules(string $mandantId, CarbonImmutable $jusquau): array
    {
        return array_values(array_filter(
            $this->mandats->feeSchedules($jusquau->toDateString()),
            fn (MandateFeeScheduleData $m): bool => $m->mandantPartyId === $mandantId,
        ));
    }

    /**
     * @param  list<MandateFeeScheduleData>  $mandats
     * @return array<string, list<CollectionMovementData>> mouvements non nuls du mandant, par identifiant de mandat
     */
    public function byMandate(string $mandantId, array $mandats, Currency $devise, CarbonImmutable $du, CarbonImmutable $au): array
    {
        $parMandat = [];

        foreach ($this->agregats->collections([AccountRole::OwnerRentCalled, AccountRole::OwnerChargesCalled], $devise, $du, $au) as $mouvement) {
            if ($mouvement->partyId !== $mandantId || $mouvement->amount->isZero()) {
                continue;
            }

            $mandat = $this->mandateOf($mouvement, $mandats);

            if ($mandat !== null) {
                $parMandat[$mandat->mandateId][] = $mouvement;
            }
        }

        return $parMandat;
    }

    /**
     * @param  list<CollectionMovementData>  $mouvements
     * @return non-empty-list<FeeSegmentData>|null null sans mouvement
     */
    public function segments(MandateFeeScheduleData $mandat, array $mouvements, CarbonImmutable $dernierJour): ?array
    {
        if ($mouvements === [] || $mandat->terms === []) {
            return null;
        }

        $parBareme = [];

        foreach ($mouvements as $mouvement) {
            $bareme = $this->termAt($mandat, $mouvement->date);
            $cle = $bareme->id;
            $parBareme[$cle] ??= ['term' => $bareme, 'rent' => 0, 'charges' => 0];
            $champ = $mouvement->role === AccountRole::OwnerRentCalled ? 'rent' : 'charges';
            $parBareme[$cle][$champ] += (int) $mouvement->amount->getAmount();
        }

        uasort($parBareme, fn (array $a, array $b): int => $a['term']->validFrom <=> $b['term']->validFrom);
        $segments = array_values(array_map(fn (array $s): FeeSegmentData => new FeeSegmentData($s['term'], $s['rent'], $s['charges']), $parBareme));
        $dernier = $this->termAt($mandat, $dernierJour->toDateString());

        if ($segments[array_key_last($segments)]->term->id !== $dernier->id) {
            $segments[] = new FeeSegmentData($dernier, 0, 0);
        }

        return $segments;
    }

    /**
     * Mandat qui couvre le lot à la date ; à défaut le dernier échu, puis le premier.
     *
     * @param  list<MandateFeeScheduleData>  $mandats
     */
    private function mandateOf(CollectionMovementData $mouvement, array $mandats): ?MandateFeeScheduleData
    {
        $date = $mouvement->date;

        foreach ($mandats as $mandat) {
            if ($mandat->startsOn <= $date && $date < $mandat->endsOn && $this->covers($mandat, $mouvement->unitId, $date)) {
                return $mandat;
            }
        }

        $echus = array_values(array_filter($mandats, fn (MandateFeeScheduleData $m): bool => $m->endsOn <= $date));

        if ($echus !== []) {
            usort($echus, fn (MandateFeeScheduleData $a, MandateFeeScheduleData $b): int => $b->endsOn <=> $a->endsOn);

            return $echus[0];
        }

        return $mandats[0] ?? null;
    }

    private function covers(MandateFeeScheduleData $mandat, ?string $unitId, string $date): bool
    {
        foreach ($mandat->units as $lot) {
            if ($lot['unit_id'] === $unitId && $lot['valid_from'] <= $date && ($lot['valid_to'] === null || $date < $lot['valid_to'])) {
                return true;
            }
        }

        return false;
    }

    private function termAt(MandateFeeScheduleData $mandat, string $date): MandateFeeTermData
    {
        $retenu = $mandat->terms[0];

        foreach ($mandat->terms as $bareme) {
            if ($bareme->validFrom <= $date && ($bareme->validTo === null || $date < $bareme->validTo)) {
                return $bareme;
            }

            if ($bareme->validFrom <= $date) {
                $retenu = $bareme;
            }
        }

        return $retenu;
    }
}
