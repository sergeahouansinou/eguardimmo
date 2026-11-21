<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Requests;

use App\Modules\Rent\Data\NewPaymentData;
use App\Modules\Rent\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RecordPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le montant est en unités mineures de la devise du bail ; aucune devise n'est lue du client.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'lease_id' => ['required', 'uuid'],
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'reference' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    public function toData(): NewPaymentData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewPaymentData(
            leaseId: (string) $v['lease_id'],
            amount: (int) $v['amount'],
            method: PaymentMethod::from((string) $v['method']),
            receivedOn: (string) $v['received_on'],
            reference: isset($v['reference']) ? trim((string) $v['reference']) : null,
            note: isset($v['note']) ? trim((string) $v['note']) : null,
            idempotencyKey: (string) $v['idempotency_key'],
        );
    }
}
