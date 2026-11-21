<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\MandateChangesData;
use App\Modules\Mandates\Http\Support\MandateInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

final class UpdateMandateRequest extends FormRequest
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
            'mandant_party_id' => ['sometimes', 'required', 'uuid'],
            'mandate_type_term_id' => ['sometimes', 'required', 'uuid'],
            'starts_on' => ['sometimes', 'required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'end_date' => ['sometimes', 'required', 'date_format:Y-m-d', 'before_or_equal:2200-12-31'],
            'tacit_renewal' => ['sometimes', 'required', 'boolean'],
            'renewal_months' => ['sometimes', 'required', 'integer', 'between:1,120'],
            'notice_months' => ['sometimes', 'required', 'integer', 'between:0,24'],
            'currency' => ['sometimes', 'required', 'string', Rule::in(MandateInput::currencies())],
            'custom_fields' => ['array', 'max:50'],
            'note' => ['nullable', 'string', 'max:5000'],
            ...MandateInput::termRules(),
            ...MandateInput::unitRules(),
        ];
    }

    public function toData(): MandateChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new MandateChangesData(
            lockVersion: (int) $v['lock_version'],
            fields: Arr::only($v, [...MandateChangesData::DRAFT_ONLY, ...MandateChangesData::ALWAYS]),
            customFields: array_key_exists('custom_fields', $v) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
            terms: array_key_exists('terms', $v) ? MandateInput::terms($v) : null,
            replaceUnits: array_key_exists('units', $v) ? true : null,
            units: array_key_exists('units', $v) ? MandateInput::units($v) : [],
        );
    }
}
