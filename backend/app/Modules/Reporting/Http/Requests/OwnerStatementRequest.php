<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use Carbon\CarbonImmutable;
use Closure;
use DateTimeImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class OwnerStatementRequest extends FormRequest
{
    public const int JOURS_MAX = 366;

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
            'agency' => ['nullable', 'string', 'max:64'],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from', $this->withinLimit()],
            'format' => ['nullable', Rule::in(['json', 'csv'])],
        ];
    }

    public function agency(): ?string
    {
        return $this->filled('agency') ? (string) $this->validated('agency') : null;
    }

    public function from(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('from')) ?? CarbonImmutable::today();
    }

    public function to(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('to')) ?? CarbonImmutable::today();
    }

    public function wantsCsv(): bool
    {
        return $this->validated('format') === 'csv';
    }

    private function withinLimit(): Closure
    {
        return function (string $attribute, mixed $valeur, Closure $fail): void {
            $debut = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $this->input('from'));
            $fin = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $valeur);

            if ($debut !== false && $fin !== false && (int) $debut->diff($fin)->days + 1 > self::JOURS_MAX) {
                $fail('La période ne peut pas dépasser '.self::JOURS_MAX.' jours.');
            }
        };
    }
}
