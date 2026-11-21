<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use App\Modules\Investments\Data\PrepaymentData;
use App\Modules\Investments\Enums\PrepaymentOption;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class PrepaymentRequest extends FormRequest
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
            'date' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'option' => ['required', Rule::enum(PrepaymentOption::class)],
            'penalty' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'lock_version' => ['required', 'integer', 'min:1'],
            'outstanding' => ['prohibited'],
            'interest' => ['prohibited'],
        ];
    }

    public function toData(): PrepaymentData
    {
        $v = $this->validated();

        return new PrepaymentData((string) $v['date'], (int) $v['amount'], PrepaymentOption::from((string) $v['option']), (int) ($v['penalty'] ?? 0), (int) $v['lock_version']);
    }
}
