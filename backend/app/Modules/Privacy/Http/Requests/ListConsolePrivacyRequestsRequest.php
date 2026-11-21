<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Requests;

use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListConsolePrivacyRequestsRequest extends FormRequest
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
            'status' => ['nullable', 'string', Rule::enum(RequestStatus::class)],
            'kind' => ['nullable', 'string', Rule::enum(RequestKind::class)],
            'overdue' => ['nullable', 'boolean'],
        ];
    }

    public function status(): ?RequestStatus
    {
        return $this->filled('status') ? RequestStatus::from((string) $this->validated('status')) : null;
    }

    public function kind(): ?RequestKind
    {
        return $this->filled('kind') ? RequestKind::from((string) $this->validated('kind')) : null;
    }

    public function overdue(): bool
    {
        return $this->boolean('overdue');
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
