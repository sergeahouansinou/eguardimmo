<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\SupplierPaymentInputData;
use App\Modules\Maintenance\Enums\SupplierPaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SupplierPaymentRequest extends FormRequest
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
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'method' => ['required', Rule::enum(SupplierPaymentMethod::class)],
            'paid_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'reference' => ['nullable', 'string', 'max:120'],
            'own_funds_advance' => ['sometimes', 'boolean'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    public function toData(): SupplierPaymentInputData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new SupplierPaymentInputData(
            (int) $v['amount'],
            SupplierPaymentMethod::from((string) $v['method']),
            (string) $v['paid_on'],
            isset($v['reference']) ? trim((string) $v['reference']) : null,
            (string) $v['idempotency_key'],
            (bool) ($v['own_funds_advance'] ?? false),
        );
    }
}
