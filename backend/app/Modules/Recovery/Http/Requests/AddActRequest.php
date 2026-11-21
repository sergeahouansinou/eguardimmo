<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use App\Modules\Recovery\Data\NewActData;
use App\Modules\Recovery\Enums\ActType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AddActRequest extends FormRequest
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
        return [
            'type' => ['required', Rule::in(array_map(fn (ActType $t): string => $t->value, ActType::manual()))],
            'performed_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:500'],
            'reference' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function toData(): NewActData
    {
        return new NewActData(
            ActType::from((string) $this->validated('type')),
            (string) $this->validated('performed_on'),
            $this->filled('note') ? trim((string) $this->validated('note')) : null,
            $this->filled('reference') ? trim((string) $this->validated('reference')) : null,
        );
    }
}
