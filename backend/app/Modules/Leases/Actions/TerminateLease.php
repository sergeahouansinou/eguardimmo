<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\TerminationData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Events\LeaseTerminated;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Support\OccupationExtension;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

final readonly class TerminateLease
{
    public function __construct(
        private Leases $baux,
        private RecordNotice $preavis,
        private OccupationExtension $prolongation,
        private RecordAudit $audit,
    ) {}

    /**
     * Les lignes de lots, de parties et de composantes encore en vigueur à la date de fin sont fermées à cette date ;
     * les lignes passées ne bougent pas et rien n'est supprimé. Les écritures de masse ne déclenchent pas l'audit Eloquent :
     * le journal est tenu ici, dans la même transaction. Une fin plus tardive que la fin effective actuelle prolonge
     * l'occupation des lots : elle prend le verrou des lots et refuse tout chevauchement, comme le renouvellement.
     */
    public function handle(Lease $lease, TerminationData $donnees): Lease
    {
        return DB::transaction(function () use ($lease, $donnees): Lease {
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

            $fin = $this->endDate($bail, $donnees);
            $amiable = $this->assertTerminable($bail, $donnees, $fin);

            $jour = $fin->toDateString();
            $this->prolongation->assertFree($bail, $jour);
            $fermees = [
                'units' => $this->close(LeaseUnit::query(), $bail, $jour),
                'parties' => $this->close(LeaseParty::query(), $bail, $jour),
                'terms' => $this->close(LeaseTerm::query(), $bail, $jour),
            ];

            if ($amiable !== null) {
                $bail->termination_reason = $amiable['reason'];

                if ($bail->notice_received_on === null && $amiable['by'] !== null) {
                    $bail->setAttribute('notice_received_on', CarbonImmutable::today()->toDateString());
                    $bail->notice_given_by = $amiable['by'];
                }
            }

            if ($bail->notice_received_on !== null) {
                $bail->setAttribute('notice_departure_on', $jour);
            }

            $bail->status = LeaseStatus::Terminated;
            $bail->setAttribute('ends_on', $jour);
            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.lease.terminated', subject: $bail, metadata: [
                'ends_on' => $jour,
                'amicable' => $amiable !== null,
                'closed' => $fermees,
            ]);

            LeaseTerminated::dispatch($bail->id, $bail->organization_id, $jour);

            return $bail;
        });
    }

    private function endDate(Lease $bail, TerminationData $donnees): CarbonImmutable
    {
        if ($donnees->endsOn !== null) {
            return CarbonImmutable::parse($donnees->endsOn);
        }

        if ($bail->notice_departure_on === null) {
            throw ErrorCode::LeasePeriodInvalid->problem('La date de fin est obligatoire quand aucun préavis n\'est enregistré.');
        }

        return CarbonImmutable::parse((string) $bail->effectiveEnd());
    }

    /**
     * @return array{reason: string, by: NoticeGivenBy|null}|null la résiliation amiable, ou null si le préavis légal est respecté
     */
    private function assertTerminable(Lease $bail, TerminationData $donnees, CarbonImmutable $fin): ?array
    {
        $jour = $fin->toDateString();

        if ($jour <= $bail->starts_on->toDateString() || ($bail->ends_on !== null && $jour > $bail->ends_on->toDateString())) {
            throw ErrorCode::LeasePeriodInvalid->problem('La date de fin doit suivre le début du bail et ne pas dépasser son terme.');
        }

        foreach ([LeaseUnit::class, LeaseParty::class, LeaseTerm::class] as $modele) {
            if ($modele::query()->where('lease_id', $bail->id)->where('valid_from', '>=', $jour)->lockForUpdate()->first(['id']) !== null) {
                throw ErrorCode::LeasePeriodInvalid->problem('Des lots, parties ou composantes commencent à cette date ou après : modifiez-les avant de résilier.');
            }
        }

        $avecPreavis = $bail->notice_received_on !== null && $bail->notice_given_by !== null;

        if ($avecPreavis) {
            $minimum = $this->preavis->minimumDeparture($bail, $bail->notice_given_by, CarbonImmutable::parse($bail->notice_received_on->toDateString()));

            if ($bail->notice_given_by === NoticeGivenBy::Landlord && $bail->notice_departure_on !== null) {
                $minimum = $minimum->max(CarbonImmutable::parse($bail->notice_departure_on->toDateString()));
            }

            if ($bail->ends_on !== null) {
                $minimum = $minimum->min(CarbonImmutable::parse($bail->ends_on->toDateString()));
            }

            if ($fin >= $minimum) {
                return null;
            }
        }

        if (! $donnees->amicable) {
            throw ErrorCode::LeaseNoticeInvalid->problem($avecPreavis
                ? 'La date de fin précède la fin du préavis légal : demandez une résiliation amiable explicite.'
                : 'Aucun préavis n\'est enregistré : demandez une résiliation amiable explicite.');
        }

        $motif = trim((string) $donnees->terminationReason);

        if ($motif === '') {
            throw ErrorCode::LeaseNoticeInvalid->problem('Le motif de la résiliation amiable est obligatoire.');
        }

        if (! $avecPreavis && $donnees->requestedBy === null) {
            throw ErrorCode::LeaseNoticeInvalid->problem('Indiquez qui demande la résiliation amiable : le locataire ou le bailleur.');
        }

        return ['reason' => $motif, 'by' => $donnees->requestedBy];
    }

    /**
     * @param  Builder<covariant Model>  $requete
     */
    private function close(Builder $requete, Lease $bail, string $jour): int
    {
        return $requete
            ->where('lease_id', $bail->id)
            ->where('valid_from', '<', $jour)
            ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
            ->update(['valid_to' => $jour]);
    }
}
