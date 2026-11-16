<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class OccupancyRequest extends FormRequest
{
    public const MAX_LOTS = 200;

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
            'units' => ['required', 'array', 'min:1', 'max:'.self::MAX_LOTS],
            'units.*' => ['required', 'string', 'uuid'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return list<string>
     */
    public function unitIds(): array
    {
        /** @var list<string> $ids */
        $ids = $this->validated('units');

        return array_values(array_unique($ids));
    }

    public function day(): CarbonImmutable
    {
        return $this->filled('date') ? CarbonImmutable::parse((string) $this->validated('date'))->startOfDay() : CarbonImmutable::today();
    }
}
