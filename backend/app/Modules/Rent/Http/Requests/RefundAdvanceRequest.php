<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RefundAdvanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le montant est en unités mineures de la devise du bail ; aucune devise ni source de fonds n'est lue du client.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'refunded_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'reference' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function amount(): int
    {
        return (int) $this->validated('amount');
    }

    public function refundedOn(): ?string
    {
        return $this->filled('refunded_on') ? (string) $this->validated('refunded_on') : null;
    }

    public function reference(): ?string
    {
        return $this->filled('reference') ? trim((string) $this->validated('reference')) : null;
    }
}
