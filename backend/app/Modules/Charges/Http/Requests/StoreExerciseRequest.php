<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use App\Modules\Charges\Http\Support\ParsesItems;
use Illuminate\Foundation\Http\FormRequest;

final class StoreExerciseRequest extends FormRequest
{
    use ParsesItems;

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
            'property_id' => ['required', 'uuid'],
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d', 'after:period_start'],
            ...$this->itemRules(),
        ];
    }

    public function propertyId(): string
    {
        return (string) $this->validated('property_id');
    }

    public function periodStart(): string
    {
        return (string) $this->validated('period_start');
    }

    public function periodEnd(): string
    {
        return (string) $this->validated('period_end');
    }
}
