<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

final class FinancePeriodRequest extends FormRequest
{
    public const int MONTHS_MAX = 36;

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
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from', $this->withinLimit()],
        ];
    }

    public function from(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('from')) ?? CarbonImmutable::today();
    }

    public function to(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('to')) ?? CarbonImmutable::today();
    }

    private function withinLimit(): Closure
    {
        return function (string $attribute, mixed $valeur, Closure $fail): void {
            $debut = CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->input('from'));
            $fin = CarbonImmutable::createFromFormat('!Y-m-d', (string) $valeur);

            if ($debut !== null && $fin !== null && $fin->greaterThanOrEqualTo($debut->addMonthsNoOverflow(self::MONTHS_MAX))) {
                $fail('La période ne peut pas dépasser '.self::MONTHS_MAX.' mois.');
            }
        };
    }
}
