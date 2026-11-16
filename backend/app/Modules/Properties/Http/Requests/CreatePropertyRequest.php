<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\NewPropertyData;
use App\Modules\Properties\Enums\PropertyType;
use App\Modules\Properties\Support\PropertyRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreatePropertyRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:200'],
            'type' => ['required', Rule::enum(PropertyType::class)],
            ...PropertyRules::address(true),
            'custom_fields' => ['array'],
            'tag_ids' => ['array', 'max:50'],
            'tag_ids.*' => ['uuid', 'distinct'],
        ];
    }

    public function toData(): NewPropertyData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewPropertyData(
            name: trim((string) $v['name']),
            type: PropertyType::from((string) $v['type']),
            address: PropertyRules::normalizeAddress((array) $v['address']),
            customFields: is_array($v['custom_fields'] ?? null) ? $v['custom_fields'] : [],
            tagIds: array_values(array_map(strval(...), (array) ($v['tag_ids'] ?? []))),
        );
    }
}
