<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\NewUnitData;
use Illuminate\Foundation\Http\FormRequest;

final class CreateUnitRequest extends FormRequest
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
        return [
            'property_id' => ['required', 'uuid'],
            'parent_unit_id' => ['nullable', 'uuid'],
            'unit_type_term_id' => ['required', 'uuid'],
            'reference' => ['required', 'string', 'max:60'],
            'floor' => ['nullable', 'integer', 'between:-20,300'],
            'surface_hundredths' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'characteristics' => ['array'],
            'custom_fields' => ['array'],
            'tag_ids' => ['array', 'max:50'],
            'tag_ids.*' => ['uuid', 'distinct'],
        ];
    }

    public function toData(): NewUnitData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewUnitData(
            propertyId: (string) $v['property_id'],
            parentUnitId: isset($v['parent_unit_id']) ? (string) $v['parent_unit_id'] : null,
            unitTypeTermId: (string) $v['unit_type_term_id'],
            reference: trim((string) $v['reference']),
            floor: isset($v['floor']) ? (int) $v['floor'] : null,
            surfaceHundredths: isset($v['surface_hundredths']) ? (int) $v['surface_hundredths'] : null,
            characteristics: is_array($v['characteristics'] ?? null) ? $v['characteristics'] : [],
            customFields: is_array($v['custom_fields'] ?? null) ? $v['custom_fields'] : [],
            tagIds: array_values(array_map(strval(...), (array) ($v['tag_ids'] ?? []))),
        );
    }
}
