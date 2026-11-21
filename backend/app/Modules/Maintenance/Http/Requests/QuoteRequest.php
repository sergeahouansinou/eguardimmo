<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\QuoteInputData;
use App\Modules\Maintenance\Enums\QuoteKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class QuoteRequest extends FormRequest
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
            'reference' => ['required', 'string', 'max:60'],
            'kind' => ['required', Rule::enum(QuoteKind::class)],
            'issued_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'valid_until' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:issued_on'],
            'proposed_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'message' => ['nullable', 'string', 'max:500'],
            'file_id' => ['required', 'uuid'],
            'declared_gross' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.label' => ['required', 'string', 'min:1', 'max:200'],
            'lines.*.quantity_milli' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'lines.*.unit' => ['nullable', 'string', 'max:20'],
            'lines.*.unit_price' => ['required', 'integer', 'min:0', 'max:100000000000'],
            'lines.*.tax_rate_key' => ['required', 'string', 'max:80'],
        ];
    }

    public function toData(): QuoteInputData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        /** @var list<array{label: string, quantity_milli: int, unit: string|null, unit_price: int, tax_rate_key: string}> $lignes */
        $lignes = array_values(array_map(fn (array $l): array => [
            'label' => trim((string) $l['label']),
            'quantity_milli' => (int) $l['quantity_milli'],
            'unit' => isset($l['unit']) ? trim((string) $l['unit']) : null,
            'unit_price' => (int) $l['unit_price'],
            'tax_rate_key' => (string) $l['tax_rate_key'],
        ], (array) $v['lines']));

        return new QuoteInputData(
            trim((string) $v['reference']),
            QuoteKind::from((string) $v['kind']),
            (string) $v['issued_on'],
            isset($v['valid_until']) ? (string) $v['valid_until'] : null,
            isset($v['proposed_on']) ? (string) $v['proposed_on'] : null,
            isset($v['message']) ? trim((string) $v['message']) : null,
            (string) $v['file_id'],
            $lignes,
            isset($v['declared_gross']) ? (int) $v['declared_gross'] : null,
        );
    }
}
