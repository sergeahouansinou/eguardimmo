<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\NewLeaseData;
use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\PaymentMethod;
use App\Modules\Leases\Enums\Periodicity;
use App\Modules\Leases\Http\Support\DraftLeaseInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateLeaseRequest extends FormRequest
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
            'jurisdiction' => ['required', 'string', 'regex:/^[A-Z]{2}$/'],
            'regime_key' => ['required', 'string', 'max:80'],
            'starts_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'duration_months' => ['nullable', 'integer', 'min:1', 'max:1200'],
            'tacit_renewal' => ['nullable', 'boolean'],
            'due_day' => ['required', 'integer', 'between:1,28'],
            'periodicity' => ['required', Rule::enum(Periodicity::class)],
            'billing_timing' => ['required', Rule::enum(BillingTiming::class)],
            'payment_method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'jurisdiction_data' => ['array', 'max:20'],
            'custom_fields' => ['array', 'max:50'],
            'note' => ['nullable', 'string', 'max:5000'],
            'units' => ['required', 'array', 'min:1', 'max:20'],
            ...DraftLeaseInput::rules(),
        ];
    }

    public function toData(): NewLeaseData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewLeaseData(
            jurisdiction: (string) $v['jurisdiction'],
            regimeKey: (string) $v['regime_key'],
            startsOn: (string) $v['starts_on'],
            durationMonths: isset($v['duration_months']) ? (int) $v['duration_months'] : null,
            tacitRenewal: isset($v['tacit_renewal']) ? (bool) $v['tacit_renewal'] : null,
            dueDay: (int) $v['due_day'],
            periodicity: Periodicity::from((string) $v['periodicity']),
            billingTiming: BillingTiming::from((string) $v['billing_timing']),
            paymentMethod: isset($v['payment_method']) ? PaymentMethod::from((string) $v['payment_method']) : null,
            jurisdictionData: is_array($v['jurisdiction_data'] ?? null) ? $v['jurisdiction_data'] : [],
            customFields: is_array($v['custom_fields'] ?? null) ? $v['custom_fields'] : [],
            note: isset($v['note']) ? (string) $v['note'] : null,
            units: DraftLeaseInput::units($v),
            parties: DraftLeaseInput::parties($v),
            terms: DraftLeaseInput::terms($v),
        );
    }
}
