<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\RenewalData;
use Illuminate\Foundation\Http\FormRequest;

final class RenewLeaseRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'duration_months' => ['nullable', 'integer', 'between:1,120'],
            'changes' => ['sometimes', 'array', 'max:'.ReviseLeaseTermsRequest::MAX_CHANGES],
            'changes.*.component_term_id' => ['required', 'uuid', 'distinct'],
            'changes.*.close' => ['sometimes', 'boolean'],
            'changes.*.amount' => ['nullable', 'integer', 'min:0', 'max:'.ReviseLeaseTermsRequest::MAX_AMOUNT],
            'changes.*.vat_bp' => ['nullable', 'integer', 'between:0,10000'],
            'changes.*.indexed' => ['nullable', 'boolean'],
        ];
    }

    public function toData(): RenewalData
    {
        /** @var array{lock_version: int|string, duration_months?: int|string|null, changes?: list<array<string, mixed>>} $v */
        $v = $this->validated();

        return new RenewalData(
            lockVersion: (int) $v['lock_version'],
            durationMonths: isset($v['duration_months']) ? (int) $v['duration_months'] : null,
            changes: array_map(fn (array $c): array => [
                'component_term_id' => (string) $c['component_term_id'],
                'amount' => isset($c['amount']) ? (int) $c['amount'] : null,
                'vat_bp' => isset($c['vat_bp']) ? (int) $c['vat_bp'] : null,
                'indexed' => isset($c['indexed']) ? (bool) $c['indexed'] : null,
                'close' => (bool) ($c['close'] ?? false),
            ], $v['changes'] ?? []),
        );
    }
}
