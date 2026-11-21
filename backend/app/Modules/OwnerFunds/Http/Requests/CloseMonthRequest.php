<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class CloseMonthRequest extends FormRequest
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
        return ['month' => ['required', 'date_format:Y-m', 'after_or_equal:2000-01']];
    }

    public function month(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m', (string) $this->validated('month')) ?: CarbonImmutable::now()->startOfMonth();
    }
}
