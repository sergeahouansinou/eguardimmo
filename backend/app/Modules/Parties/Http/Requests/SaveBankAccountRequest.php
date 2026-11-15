<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Data\NewBankAccountData;
use App\Modules\Parties\Support\IbanRule;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class SaveBankAccountRequest extends FormRequest
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
            'iban' => ['required', 'string', 'max:50', new IbanRule],
            'bic' => ['nullable', 'string', 'regex:/^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/'],
            'holder_name' => ['required', 'string', 'max:200'],
            'valid_from' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function toData(): NewBankAccountData
    {
        return new NewBankAccountData(
            iban: (string) $this->validated('iban'),
            bic: $this->filled('bic') ? strtoupper((string) $this->validated('bic')) : null,
            holderName: trim((string) $this->validated('holder_name')),
            validFrom: $this->filled('valid_from') ? CarbonImmutable::parse((string) $this->validated('valid_from'))->startOfDay() : CarbonImmutable::today(),
        );
    }
}
