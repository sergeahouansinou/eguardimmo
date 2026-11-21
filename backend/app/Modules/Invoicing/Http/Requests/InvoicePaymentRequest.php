<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Requests;

use App\Modules\Invoicing\Data\NewPaymentData;
use App\Modules\Invoicing\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class InvoicePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le montant est en unités mineures de la devise de la facture ; aucune devise n'est lue du client.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'method' => ['required', Rule::in(PaymentMethod::manual())],
            'paid_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'reference' => ['nullable', 'string', 'max:120'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    public function toData(): NewPaymentData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewPaymentData(
            (int) $v['amount'],
            PaymentMethod::from((string) $v['method']),
            (string) $v['paid_on'],
            isset($v['reference']) ? trim((string) $v['reference']) : null,
            (string) $v['idempotency_key'],
        );
    }
}
