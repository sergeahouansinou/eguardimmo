<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use App\Modules\Banking\Data\BankAccountData;
use App\Modules\Banking\Enums\IdentifierKind;
use App\Modules\Banking\Support\CsvProfileRules;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ReplaceAccountRequest extends FormRequest
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
            'label' => ['required', 'string', 'max:120'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'holder_name' => ['required', 'string', 'max:140'],
            'identifier_kind' => ['required', Rule::enum(IdentifierKind::class)],
            'identifier' => ['required', 'string', 'min:4', 'max:42'],
            'country' => ['nullable', 'string', 'size:2', 'alpha'],
            'reconciliation_from' => ['required', 'date_format:Y-m-d'],
            'opening_bank_balance' => ['required', 'integer', 'min:-100000000000000', 'max:100000000000000'],
            ...CsvProfileRules::for(),
        ];
    }

    public function toData(): BankAccountData
    {
        $v = $this->validated();

        return new BankAccountData(
            null, trim((string) $v['label']), isset($v['bank_name']) ? trim((string) $v['bank_name']) : null, trim((string) $v['holder_name']),
            IdentifierKind::from((string) $v['identifier_kind']), (string) $v['identifier'], isset($v['country']) ? (string) $v['country'] : null,
            CarbonImmutable::parse((string) $v['reconciliation_from']), (int) $v['opening_bank_balance'], is_array($v['csv_profile'] ?? null) ? $v['csv_profile'] : null,
        );
    }
}
