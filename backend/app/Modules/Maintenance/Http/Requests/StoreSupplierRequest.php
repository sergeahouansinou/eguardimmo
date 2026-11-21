<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\SupplierInputData;
use Illuminate\Foundation\Http\FormRequest;

final class StoreSupplierRequest extends FormRequest
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
            'party_id' => ['required', 'uuid'],
            'trade_term_ids' => ['nullable', 'array', 'max:20'],
            'trade_term_ids.*' => ['uuid', 'distinct'],
            'preferred' => ['nullable', 'boolean'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'internal_note' => ['nullable', 'string', 'max:500'],
            'custom_fields' => ['nullable', 'array', 'max:50'],
        ];
    }

    public function toData(): SupplierInputData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new SupplierInputData(
            (string) ($v['party_id'] ?? ''),
            array_values(array_map(strval(...), (array) ($v['trade_term_ids'] ?? []))),
            (bool) ($v['preferred'] ?? false),
            isset($v['payment_terms_days']) ? (int) $v['payment_terms_days'] : null,
            isset($v['internal_note']) ? trim((string) $v['internal_note']) : null,
            isset($v['custom_fields']) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
        );
    }
}
