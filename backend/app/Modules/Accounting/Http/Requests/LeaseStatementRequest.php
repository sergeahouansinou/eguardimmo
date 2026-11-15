<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use LogicException;
use Money\Currencies\ISOCurrencies;
use Money\Currency;

final class LeaseStatementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $devises = array_map(fn (Currency $devise): string => $devise->getCode(), iterator_to_array(new ISOCurrencies));

        return [
            'currency' => ['required', 'string', Rule::in($devises)],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    public function currency(): Currency
    {
        $code = (string) $this->string('currency');

        return array_find(iterator_to_array(new ISOCurrencies), fn (Currency $devise): bool => $devise->getCode() === $code)
            ?? throw new LogicException('Devise non validée.');
    }

    public function from(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->string('from'))->startOfDay();
    }

    public function to(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->string('to'))->startOfDay();
    }
}
