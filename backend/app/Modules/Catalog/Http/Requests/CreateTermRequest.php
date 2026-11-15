<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Data\NewTermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Support\LabelRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateTermRequest extends FormRequest
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
        $vocabulaire = $this->vocabulary();
        $sens = $vocabulaire->semantics();

        return [
            'key' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{0,62}$/'],
            ...LabelRules::for('labels'),
            'semantic_key' => match (true) {
                $sens === [] => ['prohibited'],
                $vocabulaire->semanticRequired() => ['required', 'string', Rule::in($sens)],
                default => ['nullable', 'string', Rule::in($sens)],
            },
            'parent_id' => ['nullable', 'uuid'],
            'metadata' => ['nullable', 'array'],
        ];
    }

    public function vocabulary(): VocabularyKey
    {
        return VocabularyKey::from((string) $this->route('vocabulary'));
    }

    public function toData(): NewTermData
    {
        /** @var array<string, string> $libelles */
        $libelles = $this->validated('labels');
        /** @var array<string, mixed> $metadata */
        $metadata = $this->validated('metadata', []) ?? [];

        return new NewTermData(
            (string) $this->validated('key'),
            $libelles,
            $this->filled('semantic_key') ? (string) $this->validated('semantic_key') : null,
            $this->filled('parent_id') ? (string) $this->validated('parent_id') : null,
            $metadata,
        );
    }
}
