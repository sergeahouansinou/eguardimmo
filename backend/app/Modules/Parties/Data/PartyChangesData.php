<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

final readonly class PartyChangesData
{
    /**
     * @param  array<string, mixed>  $fields  colonnes transmises seulement : last_name, first_name, company_name, legal_form_term_id, birth_date, address, language
     * @param  array<string, mixed>|null  $customFields  null : inchangés
     * @param  list<string>|null  $categoryIds  null : inchangées
     * @param  list<string>|null  $tagIds  null : inchangées
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
        public ?array $customFields,
        public ?array $categoryIds,
        public ?array $tagIds,
    ) {}
}
