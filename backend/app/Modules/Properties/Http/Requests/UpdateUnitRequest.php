<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\UnitChangesData;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;

final class UpdateUnitRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'parent_unit_id' => ['nullable', 'uuid'],
            'unit_type_term_id' => ['sometimes', 'required', 'uuid'],
            'reference' => ['sometimes', 'required', 'string', 'max:60'],
            'floor' => ['nullable', 'integer', 'between:-20,300'],
            'surface_hundredths' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'characteristics' => ['array'],
            'custom_fields' => ['array'],
            'tag_ids' => ['array', 'max:50'],
            'tag_ids.*' => ['uuid', 'distinct'],
        ];
    }

    public function toData(): UnitChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $champs = Arr::only($v, ['parent_unit_id', 'unit_type_term_id', 'reference', 'floor', 'surface_hundredths']);

        if (isset($champs['reference'])) {
            $champs['reference'] = trim((string) $champs['reference']);
        }

        return new UnitChangesData(
            lockVersion: (int) $v['lock_version'],
            fields: $champs,
            characteristics: array_key_exists('characteristics', $v) && is_array($v['characteristics']) ? $v['characteristics'] : null,
            customFields: array_key_exists('custom_fields', $v) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
            tagIds: array_key_exists('tag_ids', $v) ? array_values(array_map(strval(...), (array) $v['tag_ids'])) : null,
        );
    }
}
