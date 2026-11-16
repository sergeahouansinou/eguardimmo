<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\TerminationData;
use App\Modules\Leases\Enums\NoticeGivenBy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class TerminateLeaseRequest extends FormRequest
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
            'ends_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-01-01'],
            'amicable' => ['sometimes', 'boolean'],
            'termination_reason' => ['nullable', 'required_if_accepted:amicable', 'string', 'min:3', 'max:255'],
            'requested_by' => ['nullable', Rule::enum(NoticeGivenBy::class)],
        ];
    }

    public function toData(): TerminationData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new TerminationData(
            lockVersion: (int) $v['lock_version'],
            endsOn: isset($v['ends_on']) ? (string) $v['ends_on'] : null,
            amicable: (bool) ($v['amicable'] ?? false),
            terminationReason: isset($v['termination_reason']) ? (string) $v['termination_reason'] : null,
            requestedBy: isset($v['requested_by']) ? NoticeGivenBy::from((string) $v['requested_by']) : null,
        );
    }
}
