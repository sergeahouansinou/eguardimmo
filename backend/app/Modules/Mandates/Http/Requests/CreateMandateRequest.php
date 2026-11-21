<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\NewMandateData;
use App\Modules\Mandates\Http\Support\MandateInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateMandateRequest extends FormRequest
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
            'mandant_party_id' => ['required', 'uuid'],
            'mandate_type_term_id' => ['required', 'uuid'],
            'starts_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on', 'before_or_equal:2200-12-31'],
            'tacit_renewal' => ['sometimes', 'boolean'],
            'renewal_months' => ['sometimes', 'integer', 'between:1,120'],
            'notice_months' => ['sometimes', 'integer', 'between:0,24'],
            'currency' => ['required', 'string', Rule::in(MandateInput::currencies())],
            'custom_fields' => ['array', 'max:50'],
            'note' => ['nullable', 'string', 'max:5000'],
            ...MandateInput::termRules(),
            'terms' => ['required', 'array'],
            ...MandateInput::unitRules(),
            'units' => ['required', 'array', 'min:1', 'max:50'],
        ];
    }

    public function toData(): NewMandateData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewMandateData(
            mandantPartyId: (string) $v['mandant_party_id'],
            mandateTypeTermId: (string) $v['mandate_type_term_id'],
            startsOn: (string) $v['starts_on'],
            endDate: (string) $v['end_date'],
            tacitRenewal: (bool) ($v['tacit_renewal'] ?? false),
            renewalMonths: (int) ($v['renewal_months'] ?? 12),
            noticeMonths: (int) ($v['notice_months'] ?? 3),
            currency: (string) $v['currency'],
            terms: MandateInput::terms($v),
            units: MandateInput::units($v),
            customFields: is_array($v['custom_fields'] ?? null) ? $v['custom_fields'] : [],
            note: isset($v['note']) ? (string) $v['note'] : null,
        );
    }
}
