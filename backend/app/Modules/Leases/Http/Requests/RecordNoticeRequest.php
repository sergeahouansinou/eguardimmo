<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\NoticeData;
use App\Modules\Leases\Enums\NoticeGivenBy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RecordNoticeRequest extends FormRequest
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
            'notice_given_by' => ['required', Rule::enum(NoticeGivenBy::class)],
            'notice_received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'notice_departure_on' => ['nullable', 'date_format:Y-m-d', 'after:notice_received_on', 'before_or_equal:2100-01-01'],
            'termination_reason' => ['required', 'string', 'min:3', 'max:255'],
            'replace' => ['sometimes', 'boolean'],
            'notice_request_id' => ['sometimes', 'nullable', 'uuid'],
        ];
    }

    public function toData(): NoticeData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NoticeData(
            lockVersion: (int) $v['lock_version'],
            givenBy: NoticeGivenBy::from((string) $v['notice_given_by']),
            receivedOn: (string) $v['notice_received_on'],
            departureOn: isset($v['notice_departure_on']) ? (string) $v['notice_departure_on'] : null,
            terminationReason: (string) $v['termination_reason'],
            replace: (bool) ($v['replace'] ?? false),
            noticeRequestId: isset($v['notice_request_id']) ? (string) $v['notice_request_id'] : null,
        );
    }
}
