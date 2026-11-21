<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class NewMandateData
{
    /**
     * @param  string  $endDate  dernier jour du mandat, inclus (Y-m-d)
     * @param  list<NewMandateUnitData>  $units
     * @param  array<string, mixed>  $customFields
     */
    public function __construct(
        public string $mandantPartyId,
        public string $mandateTypeTermId,
        public string $startsOn,
        public string $endDate,
        public bool $tacitRenewal,
        public int $renewalMonths,
        public int $noticeMonths,
        public string $currency,
        public NewMandateTermData $terms,
        public array $units,
        public array $customFields = [],
        public ?string $note = null,
    ) {}
}
