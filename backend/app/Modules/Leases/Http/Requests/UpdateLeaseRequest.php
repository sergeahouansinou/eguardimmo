<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\LeaseChangesData;
use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\PaymentMethod;
use App\Modules\Leases\Enums\Periodicity;
use App\Modules\Leases\Http\Support\DraftLeaseInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

final class UpdateLeaseRequest extends FormRequest
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
            'jurisdiction' => ['sometimes', 'required', 'string', 'regex:/^[A-Z]{2}$/'],
            'regime_key' => ['sometimes', 'required', 'string', 'max:80'],
            'starts_on' => ['sometimes', 'required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'duration_months' => ['sometimes', 'required', 'integer', 'min:1', 'max:1200'],
            'tacit_renewal' => ['sometimes', 'required', 'boolean'],
            'due_day' => ['sometimes', 'required', 'integer', 'between:1,28'],
            'periodicity' => ['sometimes', 'required', Rule::enum(Periodicity::class)],
            'billing_timing' => ['sometimes', 'required', Rule::enum(BillingTiming::class)],
            'payment_method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'jurisdiction_data' => ['array', 'max:20'],
            'custom_fields' => ['array', 'max:50'],
            'note' => ['nullable', 'string', 'max:5000'],
            'units' => ['array', 'min:1', 'max:20'],
            ...DraftLeaseInput::rules(),
        ];
    }

    public function toData(): LeaseChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $champs = Arr::only($v, [...LeaseChangesData::DRAFT_ONLY, ...LeaseChangesData::ALWAYS]);

        foreach (['periodicity' => Periodicity::class, 'billing_timing' => BillingTiming::class, 'payment_method' => PaymentMethod::class] as $cle => $enum) {
            if (isset($champs[$cle])) {
                $champs[$cle] = $enum::from((string) $champs[$cle]);
            }
        }

        return new LeaseChangesData(
            lockVersion: (int) $v['lock_version'],
            fields: $champs,
            customFields: array_key_exists('custom_fields', $v) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
            units: array_key_exists('units', $v) ? DraftLeaseInput::units($v) : null,
            parties: array_key_exists('parties', $v) ? DraftLeaseInput::parties($v) : null,
            terms: array_key_exists('terms', $v) ? DraftLeaseInput::terms($v) : null,
        );
    }
}
