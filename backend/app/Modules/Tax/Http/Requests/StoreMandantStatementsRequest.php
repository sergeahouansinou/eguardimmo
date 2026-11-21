<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Requests;

use App\Modules\Tax\Enums\ErrorCode;
use Closure;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

final class StoreMandantStatementsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'income_year' => ['required', 'integer', 'between:'.config('tax.income_year_min').','.config('tax.income_year_max')],
            'mandant_ids' => ['required', 'array', 'min:1'],
            'mandant_ids.*' => ['uuid', 'distinct'],
            'status' => ['prohibited'],
            'currency' => ['prohibited'],
            'amount' => ['prohibited'],
            'lines' => ['prohibited'],
            'snapshot' => ['prohibited'],
            'scope' => ['prohibited'],
        ];
    }

    /**
     * @return list<Closure>
     */
    public function after(): array
    {
        return [function (Validator $validateur): void {
            $ids = $this->input('mandant_ids');

            if (! $validateur->errors()->any() && is_array($ids) && count($ids) > (int) config('tax.statements_max_mandants')) {
                throw ErrorCode::BatchTooLarge->problem('Au plus '.(int) config('tax.statements_max_mandants').' mandants par demande.');
            }
        }];
    }

    public function year(): int
    {
        return $this->integer('income_year');
    }

    /**
     * @return list<string>
     */
    public function mandantIds(): array
    {
        return array_values(array_map(strval(...), (array) $this->validated('mandant_ids')));
    }
}
