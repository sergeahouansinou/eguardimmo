<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Data\CustomFieldChangesData;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Support\LabelRules;
use App\Modules\Catalog\Support\OptionRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateCustomFieldRequest extends FormRequest
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
            ...LabelRules::for('labels', 'sometimes'),
            'type' => ['sometimes', Rule::enum(CustomFieldType::class)],
            'vocabulary' => ['nullable', Rule::enum(VocabularyKey::class)],
            'required' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            ...OptionRules::rules(),
        ];
    }

    public function toData(): CustomFieldChangesData
    {
        /** @var array<string, string>|null $libelles */
        $libelles = $this->has('labels') ? $this->validated('labels') : null;

        return new CustomFieldChangesData(
            $libelles,
            $this->has('type') ? CustomFieldType::from((string) $this->validated('type')) : null,
            $this->filled('vocabulary') ? VocabularyKey::from((string) $this->validated('vocabulary')) : null,
            OptionRules::options($this->validated('options')),
            $this->has('required') ? $this->boolean('required') : null,
            $this->has('position') ? $this->integer('position') : null,
        );
    }
}
