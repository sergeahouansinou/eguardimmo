<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\NewLeasePartyChangeData;
use App\Modules\Leases\Enums\LeasePartyRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AddLeasePartyRequest extends FormRequest
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
            'party_id' => ['required', 'uuid'],
            'role' => ['required', Rule::enum(LeasePartyRole::class)],
            'joint_liability' => ['sometimes', 'boolean'],
            'valid_from' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'guarantees_party_id' => ['nullable', 'uuid'],
            'guarantee_limit_amount' => ['nullable', 'integer', 'min:1', 'max:999999999999'],
            'guarantee_ends_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
        ];
    }

    public function toData(): NewLeasePartyChangeData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewLeasePartyChangeData(
            lockVersion: (int) $v['lock_version'],
            partyId: (string) $v['party_id'],
            role: LeasePartyRole::from((string) $v['role']),
            jointLiability: (bool) ($v['joint_liability'] ?? false),
            validFrom: isset($v['valid_from']) ? (string) $v['valid_from'] : null,
            guaranteesPartyId: isset($v['guarantees_party_id']) ? (string) $v['guarantees_party_id'] : null,
            guaranteeLimitAmount: isset($v['guarantee_limit_amount']) ? (int) $v['guarantee_limit_amount'] : null,
            guaranteeEndsOn: isset($v['guarantee_ends_on']) ? (string) $v['guarantee_ends_on'] : null,
        );
    }
}
