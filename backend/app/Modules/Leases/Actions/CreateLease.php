<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Leases\Data\NewLeaseData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\DraftAuthor;
use App\Modules\Leases\Support\DraftLeaseChecks;
use App\Modules\Leases\Support\DraftLeaseResolver;
use App\Modules\Leases\Support\DraftLeaseStructure;
use App\Modules\Leases\Support\LeaseSequence;
use Illuminate\Support\Facades\DB;

final readonly class CreateLease
{
    public function __construct(
        private DraftLeaseResolver $resolver,
        private DraftLeaseStructure $structure,
        private DraftLeaseChecks $controles,
        private CustomFieldValidator $champs,
        private LeaseSequence $sequence,
        private DraftAuthor $auteur,
    ) {}

    public function handle(NewLeaseData $donnees): Lease
    {
        return DB::transaction(function () use ($donnees): Lease {
            $reglage = $this->resolver->resolve(
                $donnees->jurisdiction,
                $donnees->regimeKey,
                $donnees->jurisdictionData,
                $donnees->startsOn,
                $donnees->durationMonths,
                $donnees->tacitRenewal,
            );
            $personnalises = $this->champs->validate(CustomFieldEntity::Lease, $donnees->customFields);

            $bail = Lease::query()->create([
                'reference' => $this->sequence->next(now()->year),
                'jurisdiction' => $donnees->jurisdiction,
                'regime_key' => $reglage->regime->key(),
                'status' => LeaseStatus::Draft,
                'starts_on' => $donnees->startsOn,
                'duration_months' => $reglage->durationMonths,
                'tacit_renewal' => $reglage->tacitRenewal,
                'ends_on' => $reglage->endsOn,
                'due_day' => $donnees->dueDay,
                'periodicity' => $donnees->periodicity,
                'billing_timing' => $donnees->billingTiming,
                'currency' => $reglage->regime->currency(),
                'payment_method' => $donnees->paymentMethod,
                'jurisdiction_data' => $reglage->jurisdictionData,
                'custom_fields' => $personnalises,
                'note' => $donnees->note,
                'lock_version' => 1,
                'created_by_user_id' => $this->auteur->id(),
            ]);

            $this->structure->replaceUnits($bail, $donnees->units);
            $this->structure->replaceParties($bail, $donnees->parties);
            $this->structure->replaceTerms($bail, $donnees->terms);
            $this->controles->assertConsistent($bail, $reglage->regime);
            $this->champs->recordUsage(CustomFieldEntity::Lease, $personnalises);

            return $bail;
        });
    }
}
