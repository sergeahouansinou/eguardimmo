<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListAnnouncementsRequest extends FormRequest
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
        return $this->paginationRules(['id' => 'uuid']);
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
