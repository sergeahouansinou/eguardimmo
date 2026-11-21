<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TransmitRequest extends FormRequest
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
            'recipient_party_id' => ['required', 'uuid'],
            'valid_days' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('recovery.transmission.max_days')],
        ];
    }

    public function recipientPartyId(): string
    {
        return (string) $this->validated('recipient_party_id');
    }

    public function validDays(): ?int
    {
        return $this->filled('valid_days') ? $this->integer('valid_days') : null;
    }
}
