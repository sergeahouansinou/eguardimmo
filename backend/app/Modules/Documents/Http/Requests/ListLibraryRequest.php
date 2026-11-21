<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Requests;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\LibraryFilters;
use App\Modules\Documents\Enums\LibraryKind;
use App\Modules\Documents\Enums\SubjectType;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListLibraryRequest extends FormRequest
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
            'kind' => ['nullable', 'string', Rule::enum(LibraryKind::class)],
            'subject_type' => ['nullable', 'string', Rule::in(SubjectType::values()), 'required_with:subject_id'],
            'subject_id' => ['nullable', 'uuid', 'required_with:subject_type'],
            'archived' => ['nullable', 'boolean'],
        ];
    }

    public function filters(): LibraryFilters
    {
        return new LibraryFilters(
            $this->filled('kind') ? LibraryKind::from((string) $this->validated('kind')) : null,
            $this->filled('subject_type') ? new DocumentSubject((string) $this->validated('subject_type'), (string) $this->validated('subject_id')) : null,
            $this->boolean('archived'),
        );
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
