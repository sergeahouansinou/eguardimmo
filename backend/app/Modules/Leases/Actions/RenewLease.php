<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\RenewalData;
use App\Modules\Leases\Data\TermRevisionData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Events\LeaseRenewed;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Queries\UnitOccupations;
use App\Modules\Leases\Support\UnitOccupancyLock;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class RenewLease
{
    public function __construct(
        private Leases $baux,
        private LeaseRegimes $regimes,
        private UnitOccupancyLock $verrou,
        private UnitOccupations $occupations,
        private ReviseLeaseTerms $reviseur,
        private RecordAudit $audit,
    ) {}

    /**
     * Les occupations des autres baux se relisent après le verrou des lots, jamais avant : le renouvellement prolonge
     * l'occupation, il se sérialise donc avec toute signature qui vise les mêmes lots.
     * Le numéro de version est incrémenté par la révision des composantes quand il y en a une, sinon ici.
     */
    public function handle(Lease $lease, RenewalData $donnees, ?string $actorId): Lease
    {
        return DB::transaction(function () use ($lease, $donnees, $actorId): Lease {
            $bail = $this->baux->locked($lease->id);

            if ($bail->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::LeaseStaleVersion->problem();
            }

            if ($bail->archived_at !== null) {
                throw ErrorCode::LeaseArchived->problem();
            }

            match ($bail->status) {
                LeaseStatus::Signed => null,
                LeaseStatus::Draft => throw ErrorCode::LeaseNotSigned->problem(),
                LeaseStatus::Terminated, LeaseStatus::Cancelled => throw ErrorCode::LeaseAlreadyTerminated->problem(),
            };

            $ancienne = $this->assertRenewable($bail);
            $nouvelle = $this->newEnd($bail, $ancienne, $donnees->durationMonths);

            $lots = array_values(array_unique(array_map(fn (LeaseUnit $l): string => $l->unit_id, $bail->units()->whereNull('valid_to')->lockForUpdate()->get()->all())));
            $this->verrou->acquire($lots);
            $this->assertFree($bail, $lots, $ancienne, $nouvelle);

            $bail->setAttribute('ends_on', $nouvelle->toDateString());

            if ($donnees->changes === []) {
                $bail->lock_version = $bail->lock_version + 1;
                $bail->save();
            } else {
                $bail->save();
                $this->reviseur->handle($bail, new TermRevisionData($bail->lock_version, $ancienne->toDateString(), TermChangeReason::Renewal, $donnees->changes), $actorId);
                $bail = $this->baux->get($bail->id);
            }

            $this->audit->handle('leases.lease.renewed', $actorId, [
                'previous_ends_on' => $ancienne->toDateString(),
                'ends_on' => $nouvelle->toDateString(),
                'terms_revised' => count($donnees->changes),
            ], $bail);

            LeaseRenewed::dispatch($bail->id, $bail->organization_id, $ancienne->toDateString(), $nouvelle->toDateString());

            return $bail;
        });
    }

    private function assertRenewable(Lease $bail): CarbonImmutable
    {
        if ($bail->ends_on === null) {
            throw ErrorCode::LeaseRenewalNotAllowed->problem('Ce bail se reconduit tacitement : il n\'a pas de terme à prolonger.');
        }

        $terme = CarbonImmutable::parse($bail->ends_on->toDateString());
        $aujourdhui = CarbonImmutable::today();

        if ($terme < $aujourdhui) {
            throw ErrorCode::LeaseRenewalNotAllowed->problem('Le terme du bail est dépassé : le renouvellement doit être demandé au plus tard le jour du terme.');
        }

        if ($bail->tacit_renewal && $terme > $aujourdhui) {
            throw ErrorCode::LeaseRenewalNotAllowed->problem('Ce bail se reconduit tacitement : le renouvellement exprès n\'est possible qu\'au jour du terme.');
        }

        if ($bail->notice_received_on !== null) {
            throw ErrorCode::LeaseRenewalNotAllowed->problem('Un préavis est enregistré sur ce bail : il doit être levé avant de le renouveler.');
        }

        return $terme;
    }

    private function newEnd(Lease $bail, CarbonImmutable $ancienne, ?int $mois): CarbonImmutable
    {
        $regime = $this->regimes->for($bail->jurisdiction, $bail->regime_key);
        $donnees = $bail->jurisdiction_data;
        $mois ??= $regime->renewalMonths($donnees) ?? $bail->duration_months;

        if ($mois < $regime->minimumDurationMonths($donnees)) {
            throw ErrorCode::LeasePeriodInvalid->problem('La durée du renouvellement est inférieure au minimum du régime ('.$regime->minimumDurationMonths($donnees).' mois).');
        }

        $nouvelle = $ancienne->addMonthsNoOverflow($mois);
        $maximum = $regime->maximumDurationMonths($donnees);

        if ($maximum !== null && $nouvelle > CarbonImmutable::parse($bail->starts_on->toDateString())->addMonthsNoOverflow($maximum)) {
            throw ErrorCode::LeaseRenewalNotAllowed->problem('Ce régime plafonne la durée totale du bail à '.$maximum.' mois : la prolongation la dépasserait.');
        }

        return $nouvelle;
    }

    /**
     * @param  list<string>  $lots
     */
    private function assertFree(Lease $bail, array $lots, CarbonImmutable $de, CarbonImmutable $a): void
    {
        foreach ($this->occupations->of($lots, $bail->id) as $autre) {
            if ($this->occupations->overlap($de->toDateString(), $a->toDateString(), $autre['from'], $autre['to'])) {
                throw ErrorCode::LeaseOverlap->problem();
            }
        }
    }
}
