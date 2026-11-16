<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Leases\Data\LeaseChangesData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Support\DraftLeaseChecks;
use App\Modules\Leases\Support\DraftLeaseResolver;
use App\Modules\Leases\Support\DraftLeaseSettings;
use App\Modules\Leases\Support\DraftLeaseStructure;
use Illuminate\Support\Facades\DB;

final readonly class UpdateLease
{
    public function __construct(
        private Leases $baux,
        private DraftLeaseResolver $resolver,
        private DraftLeaseStructure $structure,
        private DraftLeaseChecks $controles,
        private CustomFieldValidator $champs,
    ) {}

    public function handle(Lease $bail, LeaseChangesData $changements): Lease
    {
        return DB::transaction(function () use ($bail, $changements): Lease {
            $courant = $this->baux->locked($bail->id);

            if ($courant->lock_version !== $changements->lockVersion) {
                throw ErrorCode::LeaseStaleVersion->problem();
            }

            if ($courant->archived_at !== null) {
                throw ErrorCode::LeaseArchived->problem();
            }

            match ($courant->status) {
                LeaseStatus::Terminated, LeaseStatus::Cancelled => throw ErrorCode::LeaseAlreadyTerminated->problem(),
                LeaseStatus::Signed => $changements->touchesDraftOnly() ? throw ErrorCode::LeaseNotDraft->problem() : null,
                LeaseStatus::Draft => null,
            };

            $champs = $changements->fields;
            $ancienDebut = $courant->starts_on->toDateString();

            foreach (LeaseChangesData::ALWAYS as $cle) {
                if (array_key_exists($cle, $champs)) {
                    $courant->setAttribute($cle, $champs[$cle]);
                }
            }

            $personnalises = $courant->custom_fields;

            if ($changements->customFields !== null) {
                $personnalises = $this->champs->validate(CustomFieldEntity::Lease, $changements->customFields, $courant->custom_fields);
                $courant->custom_fields = $personnalises;
            }

            $reglage = $courant->status === LeaseStatus::Draft ? $this->applyDraftFields($courant, $champs) : null;

            $courant->lock_version = $courant->lock_version + 1;
            $courant->save();

            if ($reglage !== null) {
                if ($courant->starts_on->toDateString() !== $ancienDebut) {
                    $this->structure->moveStart($courant, $ancienDebut);
                }

                if ($changements->units !== null) {
                    $this->structure->replaceUnits($courant, $changements->units);
                }

                if ($changements->parties !== null) {
                    $this->structure->replaceParties($courant, $changements->parties);
                }

                if ($changements->terms !== null) {
                    $this->structure->replaceTerms($courant, $changements->terms);
                }

                $this->controles->assertConsistent($courant, $reglage->regime);
            }

            if ($changements->customFields !== null) {
                $this->champs->recordUsage(CustomFieldEntity::Lease, $personnalises);
            }

            return $courant;
        });
    }

    /**
     * @param  array<string, mixed>  $champs
     */
    private function applyDraftFields(Lease $bail, array $champs): DraftLeaseSettings
    {
        $reglage = $this->resolver->resolve(
            (string) ($champs['jurisdiction'] ?? $bail->jurisdiction),
            (string) ($champs['regime_key'] ?? $bail->regime_key),
            array_key_exists('jurisdiction_data', $champs) && is_array($champs['jurisdiction_data']) ? $champs['jurisdiction_data'] : $bail->jurisdiction_data,
            (string) ($champs['starts_on'] ?? $bail->starts_on->toDateString()),
            array_key_exists('duration_months', $champs) ? (int) $champs['duration_months'] : $bail->duration_months,
            array_key_exists('tacit_renewal', $champs) ? (bool) $champs['tacit_renewal'] : $bail->tacit_renewal,
        );

        foreach (['jurisdiction', 'starts_on', 'due_day', 'periodicity', 'billing_timing'] as $cle) {
            if (array_key_exists($cle, $champs)) {
                $bail->setAttribute($cle, $champs[$cle]);
            }
        }

        $bail->regime_key = $reglage->regime->key();
        $bail->duration_months = $reglage->durationMonths;
        $bail->tacit_renewal = $reglage->tacitRenewal;
        $bail->setAttribute('ends_on', $reglage->endsOn);
        $bail->currency = $reglage->regime->currency();
        $bail->jurisdiction_data = $reglage->jurisdictionData;

        return $reglage;
    }
}
