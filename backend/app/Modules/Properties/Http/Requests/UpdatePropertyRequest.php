<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\PropertyChangesData;
use App\Modules\Properties\Enums\PropertyType;
use App\Modules\Properties\Support\PropertyRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdatePropertyRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:200'],
            'type' => ['sometimes', 'required', Rule::enum(PropertyType::class)],
            ...PropertyRules::address(false),
            'custom_fields' => ['array'],
            'tag_ids' => ['array', 'max:50'],
            'tag_ids.*' => ['uuid', 'distinct'],
        ];
    }

    public function toData(): PropertyChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new PropertyChangesData(
            lockVersion: (int) $v['lock_version'],
            name: isset($v['name']) ? trim((string) $v['name']) : null,
            type: isset($v['type']) ? PropertyType::from((string) $v['type']) : null,
            address: isset($v['address']) ? PropertyRules::normalizeAddress((array) $v['address']) : null,
            customFields: array_key_exists('custom_fields', $v) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
            tagIds: array_key_exists('tag_ids', $v) ? array_values(array_map(strval(...), (array) $v['tag_ids'])) : null,
        );
    }
}
