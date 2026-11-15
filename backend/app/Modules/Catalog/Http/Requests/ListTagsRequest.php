<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListTagsRequest extends FormRequest
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
        return $this->paginationRules(['name' => 'max:60', 'id' => 'uuid']);
    }
}
