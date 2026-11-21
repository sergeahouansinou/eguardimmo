<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use App\Modules\Charges\Data\ItemInputData;
use App\Modules\Charges\Http\Support\ParsesItems;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateExerciseRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'period_start' => ['sometimes', 'date_format:Y-m-d'],
            'period_end' => ['sometimes', 'date_format:Y-m-d'],
            ...$this->itemRules(),
        ];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    public function periodStart(): ?string
    {
        return $this->has('period_start') ? (string) $this->validated('period_start') : null;
    }

    public function periodEnd(): ?string
    {
        return $this->has('period_end') ? (string) $this->validated('period_end') : null;
    }

    /**
     * @return list<ItemInputData>|null
     */
    public function itemsOrNull(): ?array
    {
        return $this->has('items') ? $this->items() : null;
    }
}
