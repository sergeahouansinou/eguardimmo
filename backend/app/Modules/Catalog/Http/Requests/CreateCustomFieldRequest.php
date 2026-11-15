<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Data\NewCustomFieldData;
use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Support\LabelRules;
use App\Modules\Catalog\Support\OptionRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateCustomFieldRequest extends FormRequest
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
            'key' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{0,62}$/'],
            ...LabelRules::for('labels'),
            'type' => ['required', Rule::enum(CustomFieldType::class)],
            'vocabulary' => ['nullable', Rule::enum(VocabularyKey::class)],
            'required' => ['sometimes', 'boolean'],
            ...OptionRules::rules(),
        ];
    }

    public function toData(): NewCustomFieldData
    {
        /** @var array<string, string> $libelles */
        $libelles = $this->validated('labels');

        return new NewCustomFieldData(
            CustomFieldEntity::from((string) $this->route('entity')),
            (string) $this->validated('key'),
            $libelles,
            CustomFieldType::from((string) $this->validated('type')),
            $this->filled('vocabulary') ? VocabularyKey::from((string) $this->validated('vocabulary')) : null,
            OptionRules::options($this->validated('options')),
            $this->boolean('required'),
        );
    }
}
