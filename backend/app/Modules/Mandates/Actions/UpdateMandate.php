<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Mandates\Data\MandateChangesData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Enums\TermChangeReason;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Support\DraftMandateStructure;
use App\Modules\Mandates\Support\MandatePeriod;
use Illuminate\Support\Facades\DB;

final readonly class UpdateMandate
{
    public function __construct(
        private Mandates $mandats,
        private DraftMandateStructure $structure,
        private CustomFieldValidator $champs,
    ) {}

    public function handle(Mandate $mandate, MandateChangesData $changements): Mandate
    {
        return DB::transaction(function () use ($mandate, $changements): Mandate {
            $courant = $this->mandats->locked($mandate->id);

            if ($courant->lock_version !== $changements->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($courant->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if ($courant->status !== MandateStatus::Draft && $changements->touchesDraftOnly()) {
                throw ErrorCode::MandateNotDraft->problem();
            }

            foreach (MandateChangesData::ALWAYS as $cle) {
                if (array_key_exists($cle, $changements->fields)) {
                    $courant->setAttribute($cle, $changements->fields[$cle]);
                }
            }

            $personnalises = $courant->custom_fields;

            if ($changements->customFields !== null) {
                $personnalises = $this->champs->validate(CustomFieldEntity::Mandate, $changements->customFields, $courant->custom_fields);
                $courant->custom_fields = $personnalises;
            }

            $ancienDebut = $courant->starts_on->toDateString();

            if ($courant->status === MandateStatus::Draft) {
                $this->applyDraftFields($courant, $changements->fields);
            }

            $courant->lock_version = $courant->lock_version + 1;
            $courant->save();

            if ($courant->status === MandateStatus::Draft) {
                $this->rebuildStructure($courant, $changements, $ancienDebut);
            }

            if ($changements->customFields !== null) {
                $this->champs->recordUsage(CustomFieldEntity::Mandate, $personnalises);
            }

            return $courant;
        });
    }

    /**
     * @param  array<string, mixed>  $champs
     */
    private function applyDraftFields(Mandate $mandat, array $champs): void
    {
        if (array_key_exists('mandant_party_id', $champs)) {
            $this->structure->assertMandant((string) $champs['mandant_party_id']);
            $mandat->mandant_party_id = (string) $champs['mandant_party_id'];
        }

        if (array_key_exists('mandate_type_term_id', $champs)) {
            $this->structure->assertType((string) $champs['mandate_type_term_id']);
            $mandat->mandate_type_term_id = (string) $champs['mandate_type_term_id'];
        }

        foreach (['starts_on', 'currency', 'notice_months'] as $cle) {
            if (array_key_exists($cle, $champs)) {
                $mandat->setAttribute($cle, $champs[$cle]);
            }
        }

        $dernierJour = array_key_exists('end_date', $champs)
            ? (string) $champs['end_date']
            : $mandat->ends_on->subDay()->toDateString();

        $mandat->setAttribute('ends_on', MandatePeriod::endExclusive($mandat->starts_on->toDateString(), $dernierJour));
    }

    private function rebuildStructure(Mandate $mandat, MandateChangesData $changements, string $ancienDebut): void
    {
        if ($mandat->starts_on->toDateString() !== $ancienDebut) {
            $this->structure->moveStart($mandat, $ancienDebut);
        }

        if (array_key_exists('currency', $changements->fields)) {
            MandateTerm::query()->where('mandate_id', $mandat->id)->get()
                ->each(fn (MandateTerm $terme): bool => $terme->update(['currency' => $mandat->currency]));
        }

        if ($changements->replaceUnits === true) {
            $this->structure->replaceUnits($mandat, $changements->units);
        }

        if ($changements->terms !== null) {
            foreach (MandateTerm::query()->where('mandate_id', $mandat->id)->get() as $terme) {
                $terme->delete();
            }

            $this->structure->writeTerm($mandat, $changements->terms, $mandat->starts_on->toDateString(), TermChangeReason::Initial);
        }

        $this->structure->assertWithinPeriod($mandat);
    }
}
