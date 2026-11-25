<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Throwable;

final class AvailabilityRequest extends FormRequest
{
    private const int FENETRE_MAX_JOURS = 366;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after:from', ...$this->limiteHaute()],
        ];
    }

    public function rangeStart(): string
    {
        return (string) $this->validated('from');
    }

    public function rangeEnd(): string
    {
        return (string) $this->validated('to');
    }

    /**
     * @return list<string>
     */
    private function limiteHaute(): array
    {
        try {
            return ['before_or_equal:'.CarbonImmutable::createFromFormat('Y-m-d', (string) $this->input('from'))?->addDays(self::FENETRE_MAX_JOURS)->toDateString()];
        } catch (Throwable) {
            return [];
        }
    }
}
