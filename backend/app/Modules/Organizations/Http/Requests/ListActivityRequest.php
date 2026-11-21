<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Support\ReadsActivityFilters;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListActivityRequest extends FormRequest
{
    use PaginatesWithCursor;
    use ReadsActivityFilters;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [...$this->paginationRules(['occurred_at' => 'date', 'id' => 'uuid']), ...$this->filterRules()];
    }
}
