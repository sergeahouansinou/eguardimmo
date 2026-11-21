<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Requests;

use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Support\PlanVersionRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdatePlanVersionRequest extends FormRequest
{
    private const MONTANT_MAX = 100_000_000;

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
            'public_signup' => ['sometimes', 'boolean'],
            'prices' => ['sometimes', 'array', 'max:2'],
            'prices.*.currency' => ['required', 'string', Rule::in(PlanVersionRules::DEVISES), 'distinct'],
            'prices.*.monthly_amount' => ['required', 'integer', 'min:0', 'max:'.self::MONTANT_MAX],
            'prices.*.yearly_amount' => ['required', 'integer', 'min:0', 'max:'.self::MONTANT_MAX],
            'entitlements' => ['sometimes', 'array', 'max:'.count(Feature::cases())],
            'entitlements.*.feature' => ['required', 'string', Rule::enum(Feature::class), 'distinct'],
            'entitlements.*.enabled' => ['required', 'boolean'],
            'entitlements.*.limit_value' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        /** @var array<string, mixed> $valides */
        $valides = $this->validated();

        return $valides;
    }
}
