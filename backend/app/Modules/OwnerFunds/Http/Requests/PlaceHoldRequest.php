<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Enums\HoldReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class PlaceHoldRequest extends FormRequest
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
            'kind' => ['required', Rule::enum(HoldKind::class)],
            'amount' => ['required_if:kind,reserve', 'prohibited_if:kind,full', 'integer', 'min:1', 'max:100000000000'],
            'reason' => ['required', Rule::enum(HoldReason::class)->except(HoldReason::AccountChangeContested)],
            'comment' => ['nullable', 'string', 'max:500'],
        ];
    }
}
