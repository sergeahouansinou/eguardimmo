<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Requests;

use App\Shared\Http\ListsForOwner;
use Illuminate\Foundation\Http\FormRequest;

final class ListOwnerTaxStatementsRequest extends FormRequest
{
    use ListsForOwner;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return $this->ownerRules(['income_year' => 'integer', 'id' => 'uuid'], ['income_year' => ['nullable', 'integer', 'between:'.config('tax.income_year_min').','.config('tax.income_year_max')]]);
    }
}
