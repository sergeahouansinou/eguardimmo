<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateIdentifierRequest extends FormRequest
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
            'country' => ['string', 'regex:/^[A-Z]{2}$/'],
            'value' => ['string', 'max:60'],
        ];
    }

    public function country(): ?string
    {
        return $this->has('country') ? (string) $this->validated('country') : null;
    }

    public function value(): ?string
    {
        return $this->has('value') ? (string) $this->validated('value') : null;
    }
}
