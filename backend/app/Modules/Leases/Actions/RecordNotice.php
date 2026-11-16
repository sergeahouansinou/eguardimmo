<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\NoticeData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Events\LeaseNoticeRecorded;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Support\OccupationExtension;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class RecordNotice
{
    public function __construct(
        private Leases $baux,
        private LeaseRegimes $regimes,
        private OccupationExtension $prolongation,
        private RecordAudit $audit,
    ) {}

    public function handle(Lease $lease, NoticeData $donnees): Lease
    {
        $motif = trim($donnees->terminationReason);
        $recu = CarbonImmutable::parse($donnees->receivedOn);

        if ($motif === '') {
            throw ErrorCode::LeaseNoticeInvalid->problem('Le motif du préavis est obligatoire.');
        }

        if ($recu->toDateString() > CarbonImmutable::today()->toDateString()) {
            throw ErrorCode::LeaseNoticeInvalid->problem('La date de réception du préavis ne peut pas être dans le futur.');
        }

        return DB::transaction(function () use ($lease, $donnees, $motif, $recu): Lease {
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

            if ($bail->signed_on !== null && $recu->toDateString() < $bail->signed_on->toDateString()) {
                throw ErrorCode::LeaseNoticeInvalid->problem('Le préavis ne peut pas être reçu avant la signature du bail.');
            }

            $remplace = $bail->notice_received_on !== null;

            if ($remplace && ! $donnees->replace) {
                throw ErrorCode::LeaseNoticeExists->problem();
            }

            $depart = $this->departure($bail, $donnees, $recu);
            $this->prolongation->assertFree($bail, $bail->ends_on === null ? $depart->toDateString() : min($bail->ends_on->toDateString(), $depart->toDateString()));

            $bail->notice_given_by = $donnees->givenBy;
            $bail->setAttribute('notice_received_on', $recu->toDateString());
            $bail->setAttribute('notice_departure_on', $depart->toDateString());
            $bail->termination_reason = $motif;
            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.lease.notice_recorded', subject: $bail, metadata: [
                'given_by' => $donnees->givenBy->value,
                'received_on' => $recu->toDateString(),
                'departure_on' => $depart->toDateString(),
                'replaced' => $remplace,
            ]);

            LeaseNoticeRecorded::dispatch($bail->id, $bail->organization_id);

            return $bail;
        });
    }

    /**
     * Premier jour où le départ est permis : réception plus durée de préavis du régime.
     * Un régime sans préavis légal pour cette partie n'en admet aucun : la résiliation passe alors par la voie amiable.
     */
    public function minimumDeparture(Lease $bail, NoticeGivenBy $partie, CarbonImmutable $recu): CarbonImmutable
    {
        $regime = $this->regimes->for($bail->jurisdiction, $bail->regime_key);

        $mois = match ($partie) {
            NoticeGivenBy::Tenant => $regime->tenantNoticeMonths($bail->jurisdiction_data),
            NoticeGivenBy::Landlord => $regime->landlordNoticeMonths($bail->jurisdiction_data),
        };

        if ($mois === null) {
            throw ErrorCode::LeaseNoticeInvalid->problem('Ce régime ne prévoit pas de préavis pour cette partie : passez par une résiliation amiable.');
        }

        return $recu->addMonthsNoOverflow($mois);
    }

    /**
     * Le congé du bailleur prend effet au terme du bail, jamais avant, et doit le précéder du préavis légal ;
     * le locataire peut partir dès la fin de son préavis.
     */
    private function departure(Lease $bail, NoticeData $donnees, CarbonImmutable $recu): CarbonImmutable
    {
        $minimum = $this->minimumDeparture($bail, $donnees->givenBy, $recu);
        $demande = $donnees->departureOn !== null ? CarbonImmutable::parse($donnees->departureOn) : null;

        if ($demande !== null && $demande < $minimum) {
            throw ErrorCode::LeaseNoticeInvalid->problem('La date de départ est antérieure à la fin du préavis légal ('.$minimum->toDateString().').');
        }

        if ($donnees->givenBy === NoticeGivenBy::Tenant) {
            return $demande ?? $minimum;
        }

        $terme = $this->term($bail, $minimum) ?? throw ErrorCode::LeaseNoticeInvalid->problem('Le congé du bailleur doit être donné avant le terme du bail, dans le respect du préavis.');

        if ($demande !== null && $demande > $terme) {
            throw ErrorCode::LeaseNoticeInvalid->problem('Le congé du bailleur ne peut pas prendre effet après le terme du bail ('.$terme->toDateString().').');
        }

        return $demande ?? $terme;
    }

    /**
     * Terme du bail à retenir pour un congé dont le préavis s'achève à $minimum : `ends_on`, ou à défaut le premier
     * anniversaire de période (durée du bail) qui n'est pas antérieur à $minimum. Null : le préavis arrive après le terme.
     */
    private function term(Lease $bail, CarbonImmutable $minimum): ?CarbonImmutable
    {
        if ($bail->ends_on !== null) {
            $fin = CarbonImmutable::parse($bail->ends_on->toDateString());

            return $minimum > $fin ? null : $fin;
        }

        $debut = CarbonImmutable::parse($bail->starts_on->toDateString());

        for ($periode = 1; $periode <= 600; $periode++) {
            $terme = $debut->addMonthsNoOverflow($bail->duration_months * $periode);

            if ($terme >= $minimum) {
                return $terme;
            }
        }

        return null;
    }
}
