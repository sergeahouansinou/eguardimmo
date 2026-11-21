<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListPropertyContactsRequest extends FormRequest
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
        return [...$this->paginationRules(['id' => 'uuid']), 'unit' => ['nullable', 'uuid']];
    }

    public function unitId(): ?string
    {
        return $this->filled('unit') ? (string) $this->validated('unit') : null;
    }
}
