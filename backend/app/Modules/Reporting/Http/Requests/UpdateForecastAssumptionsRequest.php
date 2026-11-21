<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use App\Modules\Reporting\Data\ForecastAssumptionsData;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateForecastAssumptionsRequest extends FormRequest
{
    public const int ITEMS_MAX = 24;

    public const int RATE_MAX_MILLI = 10000;

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
            'lock_version' => ['required', 'integer', 'min:0'],
            'indexation_rate' => ['required', 'regex:/^\d{1,2}(\.\d{1,3})?$/', $this->rateWithinLimit()],
            'expense_growth_rate' => ['required', 'regex:/^\d{1,2}(\.\d{1,3})?$/', $this->rateWithinLimit()],
            'vacancies' => ['present', 'array', 'max:'.self::ITEMS_MAX],
            'vacancies.*' => ['array:unit_id,from,to'],
            'vacancies.*.unit_id' => ['required', 'uuid'],
            'vacancies.*.from' => ['required', 'date_format:Y-m-d'],
            'vacancies.*.to' => ['required', 'date_format:Y-m-d', 'after_or_equal:vacancies.*.from'],
            'one_off_expenses' => ['present', 'array', 'max:'.self::ITEMS_MAX],
            'one_off_expenses.*' => ['array:month,label,amount'],
            'one_off_expenses.*.month' => ['required', 'date_format:Y-m'],
            'one_off_expenses.*.label' => ['required', 'string', 'min:1', 'max:80'],
            'one_off_expenses.*.amount' => ['required', 'integer', 'min:1', 'max:999999999999'],
        ];
    }

    public function assumptions(): ForecastAssumptionsData
    {
        return new ForecastAssumptionsData(
            ForecastAssumptionsData::milli((string) $this->input('indexation_rate')),
            ForecastAssumptionsData::milli((string) $this->input('expense_growth_rate')),
            array_values(array_map(fn (array $v): array => ['unit_id' => (string) $v['unit_id'], 'from' => (string) $v['from'], 'to' => (string) $v['to']], (array) $this->validated('vacancies'))),
            array_values(array_map(fn (array $d): array => ['month' => (string) $d['month'], 'label' => trim((string) $d['label']), 'amount' => (int) $d['amount']], (array) $this->validated('one_off_expenses'))),
            (int) $this->validated('lock_version'),
        );
    }

    private function rateWithinLimit(): Closure
    {
        return function (string $attribute, mixed $valeur, Closure $fail): void {
            if (is_scalar($valeur) && ForecastAssumptionsData::milli((string) $valeur) > self::RATE_MAX_MILLI) {
                $fail('Le taux ne peut pas dépasser 10 %.');
            }
        };
    }
}
