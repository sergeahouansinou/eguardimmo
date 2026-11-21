<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use App\Modules\Charges\Data\ExpenseInputData;
use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\Enums\ExpenseSettlement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * La devise, le mandant, le statut et l'écriture sont fixés par le serveur : les envoyer est refusé.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'kind' => ['required', Rule::enum(ExpenseKind::class)],
            'category_term_id' => ['required', 'uuid'],
            'payee_party_id' => ['nullable', 'uuid'],
            'payee_label' => ['nullable', 'string', 'max:120'],
            'reference' => ['nullable', 'string', 'max:64'],
            'document_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'service_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'service_to' => ['required', 'date_format:Y-m-d', 'after:service_from'],
            'total_gross' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'tax_amount' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'recoverable_amount' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'recoverable_rubric' => ['nullable', 'string', 'max:64'],
            'settlement' => ['required', Rule::enum(ExpenseSettlement::class)],
            'paid_on' => ['nullable', 'date_format:Y-m-d'],
            'document' => ['nullable', 'file', 'max:10240'],
            'currency' => ['prohibited'],
            'status' => ['prohibited'],
            'mandant_party_id' => ['prohibited'],
            'mandate_id' => ['prohibited'],
            'ledger_entry_id' => ['prohibited'],
        ];
    }

    public function toData(string $idempotencyKey): ExpenseInputData
    {
        $v = $this->validated();

        return new ExpenseInputData(
            propertyId: (string) $v['property_id'],
            unitId: isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            kind: ExpenseKind::from((string) $v['kind']),
            categoryTermId: (string) $v['category_term_id'],
            payeePartyId: isset($v['payee_party_id']) ? (string) $v['payee_party_id'] : null,
            payeeLabel: isset($v['payee_label']) ? (string) $v['payee_label'] : null,
            reference: isset($v['reference']) ? (string) $v['reference'] : null,
            documentOn: (string) $v['document_on'],
            serviceFrom: (string) $v['service_from'],
            serviceTo: (string) $v['service_to'],
            totalGross: (int) $v['total_gross'],
            taxAmount: (int) ($v['tax_amount'] ?? 0),
            recoverableAmount: (int) ($v['recoverable_amount'] ?? 0),
            recoverableRubric: isset($v['recoverable_rubric']) ? (string) $v['recoverable_rubric'] : null,
            settlement: ExpenseSettlement::from((string) $v['settlement']),
            paidOn: isset($v['paid_on']) ? (string) $v['paid_on'] : null,
            document: $this->file('document'),
            idempotencyKey: $idempotencyKey,
        );
    }
}
