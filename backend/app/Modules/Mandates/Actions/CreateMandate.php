<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Mandates\Data\NewMandateData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Enums\TermChangeReason;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Support\DraftMandateStructure;
use App\Modules\Mandates\Support\MandateAuthor;
use App\Modules\Mandates\Support\MandatePeriod;
use App\Modules\Mandates\Support\MandateSequence;
use Illuminate\Support\Facades\DB;

final readonly class CreateMandate
{
    public function __construct(
        private DraftMandateStructure $structure,
        private CustomFieldValidator $champs,
        private MandateSequence $sequence,
        private MandateAuthor $auteur,
    ) {}

    public function handle(NewMandateData $donnees): Mandate
    {
        $fin = MandatePeriod::endExclusive($donnees->startsOn, $donnees->endDate);

        return DB::transaction(function () use ($donnees, $fin): Mandate {
            $this->structure->assertMandant($donnees->mandantPartyId);
            $this->structure->assertType($donnees->mandateTypeTermId);
            $personnalises = $this->champs->validate(CustomFieldEntity::Mandate, $donnees->customFields);

            $mandat = Mandate::query()->create([
                'reference' => $this->sequence->next(now()->year),
                'mandant_party_id' => $donnees->mandantPartyId,
                'mandate_type_term_id' => $donnees->mandateTypeTermId,
                'status' => MandateStatus::Draft,
                'starts_on' => $donnees->startsOn,
                'ends_on' => $fin,
                'tacit_renewal' => $donnees->tacitRenewal,
                'renewal_months' => $donnees->renewalMonths,
                'notice_months' => $donnees->noticeMonths,
                'currency' => $donnees->currency,
                'custom_fields' => $personnalises,
                'note' => $donnees->note,
                'lock_version' => 1,
                'created_by_user_id' => $this->auteur->id(),
            ]);

            $this->structure->replaceUnits($mandat, $donnees->units);
            $this->structure->writeTerm($mandat, $donnees->terms, $mandat->starts_on->toDateString(), TermChangeReason::Initial);
            $this->champs->recordUsage(CustomFieldEntity::Mandate, $personnalises);

            return $mandat;
        });
    }
}
