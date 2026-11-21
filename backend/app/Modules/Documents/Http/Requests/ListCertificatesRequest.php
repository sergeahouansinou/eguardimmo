<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Requests;

use App\Modules\Documents\Data\CertificateFilters;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Enums\SubjectType;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListCertificatesRequest extends FormRequest
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
            'state' => ['nullable', 'string', Rule::enum(CertificateState::class)],
            'subject_type' => ['nullable', 'string', Rule::in(SubjectType::values()), 'required_with:subject_id'],
            'subject_id' => ['nullable', 'uuid', 'required_with:subject_type'],
            'certificate_type_term_id' => ['nullable', 'uuid'],
            'include_replaced' => ['nullable', 'boolean'],
            'expires_from' => ['nullable', 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-01'],
            'expires_to' => ['nullable', 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-02', ...($this->filled('expires_from') ? ['after:expires_from'] : [])],
        ];
    }

    public function filters(): CertificateFilters
    {
        return new CertificateFilters(
            $this->filled('state') ? CertificateState::from((string) $this->validated('state')) : null,
            $this->filled('subject_type') ? new DocumentSubject((string) $this->validated('subject_type'), (string) $this->validated('subject_id')) : null,
            $this->filled('certificate_type_term_id') ? (string) $this->validated('certificate_type_term_id') : null,
            $this->boolean('include_replaced'),
            $this->filled('expires_from') ? (string) $this->validated('expires_from') : null,
            $this->filled('expires_to') ? (string) $this->validated('expires_to') : null,
        );
    }
}
