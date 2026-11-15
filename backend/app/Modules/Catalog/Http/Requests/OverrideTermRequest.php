<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Support\LabelRules;
use Illuminate\Foundation\Http\FormRequest;

final class OverrideTermRequest extends FormRequest
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
            ...LabelRules::for('labels', 'nullable'),
            'hidden' => ['required', 'boolean'],
            'position' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }

    /**
     * @return array<string, string>|null
     */
    public function labels(): ?array
    {
        /** @var array<string, string>|null $libelles */
        $libelles = $this->validated('labels');

        return $libelles === [] ? null : $libelles;
    }

    public function position(): ?int
    {
        return $this->filled('position') ? $this->integer('position') : null;
    }
}
