<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use Illuminate\Validation\Validator;

/**
 * Créances choisies par le client : échéances (`installment_ids`) et factures (`invoice_ids`), au moins une.
 */
trait ChoosesReceivables
{
    /**
     * @return array<string, list<mixed>>
     */
    protected function receivableRules(): array
    {
        return [
            'installment_ids' => ['nullable', 'array', 'max:100'],
            'installment_ids.*' => ['required', 'uuid', 'distinct'],
            'invoice_ids' => ['nullable', 'array', 'max:100'],
            'invoice_ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            if ($this->installmentIds() === [] && $this->invoiceIds() === [] && ! $v->errors()->has('installment_ids')) {
                $v->errors()->add('installment_ids', 'Choisissez au moins une créance.');
            }
        });
    }

    /**
     * @return list<string>
     */
    public function installmentIds(): array
    {
        return $this->ids('installment_ids');
    }

    /**
     * @return list<string>
     */
    public function invoiceIds(): array
    {
        return $this->ids('invoice_ids');
    }

    /**
     * @return list<string>
     */
    private function ids(string $key): array
    {
        /** @var list<string> $ids */
        $ids = array_values(array_filter((array) $this->input($key, []), 'is_string'));

        return $ids;
    }
}
