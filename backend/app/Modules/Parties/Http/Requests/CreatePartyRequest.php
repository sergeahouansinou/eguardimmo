<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Data\NewPartyData;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Support\PartyRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreatePartyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ['kind' => ['required', Rule::enum(PartyKind::class)], ...PartyRules::identity()];
    }

    public function toData(): NewPartyData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewPartyData(
            kind: PartyKind::from((string) $v['kind']),
            lastName: $this->texte($v, 'last_name'),
            firstName: $this->texte($v, 'first_name'),
            companyName: $this->texte($v, 'company_name'),
            legalFormTermId: $this->texte($v, 'legal_form_term_id'),
            birthDate: $this->texte($v, 'birth_date'),
            address: $this->adresse($v),
            language: is_string($v['language'] ?? null) ? $v['language'] : 'fr',
            customFields: is_array($v['custom_fields'] ?? null) ? $v['custom_fields'] : [],
            categoryIds: array_values(array_map(strval(...), (array) ($v['contact_category_ids'] ?? []))),
            tagIds: array_values(array_map(strval(...), (array) ($v['tag_ids'] ?? []))),
        );
    }

    /**
     * @param  array<string, mixed>  $v
     */
    private function texte(array $v, string $cle): ?string
    {
        return isset($v[$cle]) && is_string($v[$cle]) && trim($v[$cle]) !== '' ? trim($v[$cle]) : null;
    }

    /**
     * @param  array<string, mixed>  $v
     * @return array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null
     */
    private function adresse(array $v): ?array
    {
        $adresse = $v['address'] ?? null;

        if (! is_array($adresse) || $adresse === []) {
            return null;
        }

        return [
            'line1' => (string) $adresse['line1'],
            'line2' => isset($adresse['line2']) ? (string) $adresse['line2'] : null,
            'postal_code' => (string) $adresse['postal_code'],
            'city' => (string) $adresse['city'],
            'country' => (string) $adresse['country'],
        ];
    }
}
