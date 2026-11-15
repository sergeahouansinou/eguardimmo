<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Support\LabelRules;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateTermRequest extends FormRequest
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
            'metadata' => ['sometimes', 'array'],
        ];
    }

    /**
     * @return array<string, string>|null
     */
    public function labels(): ?array
    {
        /** @var array<string, string>|null $libelles */
        $libelles = $this->has('labels') ? $this->validated('labels') : null;

        return $libelles;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function metadata(): ?array
    {
        /** @var array<string, mixed>|null $metadata */
        $metadata = $this->has('metadata') ? $this->validated('metadata') : null;

        return $metadata;
    }
}
