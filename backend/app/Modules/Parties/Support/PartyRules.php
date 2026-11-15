<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use Illuminate\Validation\Rule;

final class PartyRules
{
    /**
     * Règles de format des champs d'identité ; leur cohérence avec le type est vérifiée par PartyShape.
     *
     * @return array<string, list<mixed>>
     */
    public static function identity(): array
    {
        return [
            'last_name' => ['nullable', 'string', 'max:120'],
            'first_name' => ['nullable', 'string', 'max:120'],
            'company_name' => ['nullable', 'string', 'max:200'],
            'legal_form_term_id' => ['nullable', 'uuid'],
            'birth_date' => ['nullable', 'date_format:Y-m-d', 'after:1900-01-01', 'before_or_equal:today'],
            'address' => ['nullable', 'array:line1,line2,postal_code,city,country'],
            'address.line1' => ['required_with:address', 'string', 'max:200'],
            'address.line2' => ['nullable', 'string', 'max:200'],
            'address.postal_code' => ['required_with:address', 'string', 'max:20'],
            'address.city' => ['required_with:address', 'string', 'max:100'],
            'address.country' => ['required_with:address', 'string', 'regex:/^[A-Z]{2}$/'],
            'language' => ['string', Rule::in(['fr', 'en', 'nl', 'de'])],
            'custom_fields' => ['array'],
            'contact_category_ids' => ['array', 'max:20'],
            'contact_category_ids.*' => ['uuid', 'distinct'],
            'tag_ids' => ['array', 'max:50'],
            'tag_ids.*' => ['uuid', 'distinct'],
        ];
    }
}
