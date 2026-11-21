<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\SupplierInvoiceInputData;
use Illuminate\Foundation\Http\FormRequest;

final class SupplierInvoiceRequest extends FormRequest
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
            'number' => ['required', 'string', 'max:60'],
            'invoice_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'due_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:invoice_on'],
            'file_id' => ['required', 'uuid'],
            'declared_gross' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'taxes' => ['required', 'array', 'min:1', 'max:10'],
            'taxes.*.tax_rate_key' => ['required', 'string', 'max:80'],
            'taxes.*.base' => ['required', 'integer', 'min:0', 'max:100000000000'],
            'taxes.*.tax' => ['required', 'integer', 'min:0', 'max:100000000000'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    public function toData(): SupplierInvoiceInputData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        /** @var list<array{tax_rate_key: string, base: int, tax: int}> $taxes */
        $taxes = array_values(array_map(fn (array $t): array => ['tax_rate_key' => (string) $t['tax_rate_key'], 'base' => (int) $t['base'], 'tax' => (int) $t['tax']], (array) $v['taxes']));

        return new SupplierInvoiceInputData(
            trim((string) $v['number']),
            (string) $v['invoice_on'],
            isset($v['due_on']) ? (string) $v['due_on'] : null,
            (string) $v['file_id'],
            $taxes,
            isset($v['declared_gross']) ? (int) $v['declared_gross'] : null,
            (string) $v['idempotency_key'],
        );
    }
}
