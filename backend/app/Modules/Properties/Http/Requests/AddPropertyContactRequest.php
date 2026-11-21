<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AddPropertyContactRequest extends FormRequest
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
            'party_id' => ['required', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'contact_category_id' => ['nullable', 'uuid'],
        ];
    }

    public function partyId(): string
    {
        return (string) $this->validated('party_id');
    }

    public function unitId(): ?string
    {
        return $this->filled('unit_id') ? (string) $this->validated('unit_id') : null;
    }

    public function categoryId(): ?string
    {
        return $this->filled('contact_category_id') ? (string) $this->validated('contact_category_id') : null;
    }
}
