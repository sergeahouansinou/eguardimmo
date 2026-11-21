<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class MandateChangesData
{
    /** Modifiables tant que le mandat est en brouillon. */
    public const array DRAFT_ONLY = ['mandant_party_id', 'mandate_type_term_id', 'starts_on', 'end_date', 'currency', 'notice_months'];

    /** Modifiables à tout moment, sauf mandat archivé. */
    public const array ALWAYS = ['tacit_renewal', 'renewal_months', 'note'];

    /**
     * @param  array<string, mixed>  $fields  uniquement les clés envoyées
     * @param  array<string, mixed>|null  $customFields
     * @param  list<NewMandateUnitData>  $units  remplacent les lots du brouillon quand `$replaceUnits` est vrai
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
        public ?array $customFields = null,
        public ?NewMandateTermData $terms = null,
        public ?bool $replaceUnits = null,
        public array $units = [],
    ) {}

    public function touchesDraftOnly(): bool
    {
        return array_intersect(array_keys($this->fields), self::DRAFT_ONLY) !== [] || $this->terms !== null || $this->replaceUnits === true;
    }
}
