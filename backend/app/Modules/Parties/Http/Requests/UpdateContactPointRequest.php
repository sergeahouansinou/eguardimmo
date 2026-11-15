<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateContactPointRequest extends FormRequest
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
            'value' => ['string', 'max:254'],
            'label' => ['nullable', 'string', 'max:60'],
            'is_primary' => ['sometimes', 'accepted'],
        ];
    }

    /**
     * @return array{value?: string, label?: string|null}
     */
    public function fields(): array
    {
        $champs = [];

        if ($this->has('value')) {
            $champs['value'] = (string) $this->validated('value');
        }

        if ($this->has('label')) {
            $champs['label'] = $this->filled('label') ? trim((string) $this->validated('label')) : null;
        }

        return $champs;
    }

    public function promote(): bool
    {
        return $this->has('is_primary');
    }
}
