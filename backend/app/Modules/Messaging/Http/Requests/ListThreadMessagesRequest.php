<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListThreadMessagesRequest extends FormRequest
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
        return [...$this->paginationRules(['sent_at' => 'date', 'id' => 'uuid']), 'after' => ['nullable', 'uuid']];
    }

    public function afterId(): ?string
    {
        return $this->filled('after') ? strtolower((string) $this->validated('after')) : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
