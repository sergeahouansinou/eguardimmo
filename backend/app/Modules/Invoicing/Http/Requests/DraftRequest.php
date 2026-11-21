<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Requests;

use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Data\NewLineData;
use App\Modules\Invoicing\Enums\TaxCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Ni taux, ni total, ni devise, ni numéro, ni statut : le serveur les détermine. Les montants sont en unités mineures.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        $creation = $this->isMethod('POST');

        return [
            'recipient_party_id' => ['required', 'uuid'],
            'lease_id' => ['nullable', 'uuid'],
            'mandate_id' => ['nullable', 'uuid'],
            'due_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before:2100-01-01'],
            'service_from' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'service_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:service_from', 'before:2100-01-01'],
            'idempotency_key' => [$creation ? 'required' : 'prohibited', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
            'lock_version' => [$creation ? 'prohibited' : 'required', 'integer', 'min:0'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.item_term_id' => ['required', 'uuid'],
            'lines.*.description' => ['required', 'string', 'min:1', 'max:255'],
            'lines.*.quantity_milli' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'lines.*.unit_price' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'lines.*.tax_category' => ['required', Rule::enum(TaxCategory::class)],
            'lines.*.tax_rate_key' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9_.-]+$/'],
        ];
    }

    public function toData(): DraftData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        /** @var list<array<string, mixed>> $lignes */
        $lignes = $v['lines'];

        return new DraftData(
            recipientPartyId: (string) $v['recipient_party_id'],
            leaseId: isset($v['lease_id']) ? (string) $v['lease_id'] : null,
            mandateId: isset($v['mandate_id']) ? (string) $v['mandate_id'] : null,
            dueOn: isset($v['due_on']) ? (string) $v['due_on'] : null,
            serviceFrom: isset($v['service_from']) ? (string) $v['service_from'] : null,
            serviceTo: isset($v['service_to']) ? (string) $v['service_to'] : null,
            lines: array_map(fn (array $l): NewLineData => new NewLineData(
                (string) $l['item_term_id'],
                trim((string) $l['description']),
                (int) $l['quantity_milli'],
                (int) $l['unit_price'],
                TaxCategory::from((string) $l['tax_category']),
                isset($l['tax_rate_key']) ? (string) $l['tax_rate_key'] : null,
            ), $lignes),
            idempotencyKey: isset($v['idempotency_key']) ? (string) $v['idempotency_key'] : null,
            lockVersion: isset($v['lock_version']) ? (int) $v['lock_version'] : null,
        );
    }
}
