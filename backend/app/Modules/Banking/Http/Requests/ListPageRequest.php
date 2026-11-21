<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

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
            'account_id' => ['nullable', 'uuid'],
            'status' => ['nullable', 'string', 'max:12'],
        ];
    }
}
