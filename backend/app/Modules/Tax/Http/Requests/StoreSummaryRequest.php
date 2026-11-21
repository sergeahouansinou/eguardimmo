<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreSummaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le client choisit l'année et déclare son foyer ; jamais un montant, une devise, un statut, une portée ni un mandant.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'income_year' => ['required', 'integer', 'between:'.config('tax.income_year_min').','.config('tax.income_year_max')],
            'household_complete' => ['sometimes', 'boolean'],
            'scope' => ['prohibited'],
            'mandant_party_id' => ['prohibited'],
            'status' => ['prohibited'],
            'currency' => ['prohibited'],
            'amount' => ['prohibited'],
            'lines' => ['prohibited'],
            'snapshot' => ['prohibited'],
        ];
    }

    public function year(): int
    {
        return $this->integer('income_year');
    }

    public function householdComplete(): bool
    {
        return $this->boolean('household_complete');
    }
}
