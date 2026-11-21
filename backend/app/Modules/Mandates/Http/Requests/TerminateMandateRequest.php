<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\TerminateMandateData;
use Illuminate\Foundation\Http\FormRequest;

final class TerminateMandateRequest extends FormRequest
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
            'notice_given_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'effective_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:notice_given_on', 'before_or_equal:2200-12-31'],
            'reason' => ['required', 'string', 'min:2', 'max:255'],
            'amicable' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function toData(): TerminateMandateData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new TerminateMandateData(
            lockVersion: (int) $v['lock_version'],
            noticeGivenOn: (string) $v['notice_given_on'],
            effectiveOn: (string) $v['effective_on'],
            reason: trim((string) $v['reason']),
            amicable: (bool) ($v['amicable'] ?? false),
            note: isset($v['note']) ? (string) $v['note'] : null,
        );
    }
}
