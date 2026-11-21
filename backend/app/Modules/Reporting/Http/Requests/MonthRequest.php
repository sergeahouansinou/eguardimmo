<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class MonthRequest extends FormRequest
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
        return ['month' => ['nullable', 'date_format:Y-m']];
    }

    public function month(): ?string
    {
        $mois = $this->validated('month');

        return is_string($mois) ? $mois : null;
    }
}
