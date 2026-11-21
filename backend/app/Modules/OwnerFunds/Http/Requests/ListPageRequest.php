<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListPageRequest extends FormRequest
{
    use PaginatesWithCursor;

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
            ...$this->paginationRules(['id' => 'uuid']),
            'mandant' => ['nullable', 'uuid'],
            'month' => ['nullable', 'date_format:Y-m'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
