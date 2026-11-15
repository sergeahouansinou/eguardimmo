<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Data\PartyChangesData;
use App\Modules\Parties\Support\PartyRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;

final class UpdatePartyRequest extends FormRequest
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
        return ['lock_version' => ['required', 'integer', 'min:1'], ...PartyRules::identity()];
    }

    public function toData(): PartyChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        $champs = Arr::only($v, ['last_name', 'first_name', 'company_name', 'legal_form_term_id', 'birth_date', 'address', 'language']);

        foreach (['last_name', 'first_name', 'company_name'] as $cle) {
            if (array_key_exists($cle, $champs) && is_string($champs[$cle])) {
                $champs[$cle] = trim($champs[$cle]) === '' ? null : trim($champs[$cle]);
            }
        }

        return new PartyChangesData(
            lockVersion: (int) $v['lock_version'],
            fields: $champs,
            customFields: array_key_exists('custom_fields', $v) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
            categoryIds: array_key_exists('contact_category_ids', $v) ? array_values(array_map(strval(...), (array) $v['contact_category_ids'])) : null,
            tagIds: array_key_exists('tag_ids', $v) ? array_values(array_map(strval(...), (array) $v['tag_ids'])) : null,
        );
    }
}
