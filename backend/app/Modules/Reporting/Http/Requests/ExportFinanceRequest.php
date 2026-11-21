<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use App\Modules\Reporting\Enums\ErrorCode;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

final class ExportFinanceRequest extends FormRequest
{
    public const array TYPES = ['prets-immobiliers', 'rentabilite-par-bien'];

    public function authorize(): bool
    {
        in_array($this->route('type'), self::TYPES, true) || throw ErrorCode::ExportTypeUnknown->problem();

        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        if ($this->route('type') === 'prets-immobiliers') {
            return [
                'from' => ['required', 'date_format:Y-m-d'],
                'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from', $this->withinLimit()],
            ];
        }

        return ['year' => ['required', 'integer']];
    }

    public function from(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('from')) ?? CarbonImmutable::today();
    }

    public function to(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('to')) ?? CarbonImmutable::today();
    }

    public function year(): int
    {
        return (int) $this->validated('year');
    }

    private function withinLimit(): Closure
    {
        return function (string $attribute, mixed $valeur, Closure $fail): void {
            $debut = CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->input('from'));
            $fin = CarbonImmutable::createFromFormat('!Y-m-d', (string) $valeur);

            if ($debut !== null && $fin !== null && $fin->greaterThanOrEqualTo($debut->addMonthsNoOverflow(FinancePeriodRequest::MONTHS_MAX))) {
                $fail('La période ne peut pas dépasser '.FinancePeriodRequest::MONTHS_MAX.' mois.');
            }
        };
    }
}
