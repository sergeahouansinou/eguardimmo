<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Requests;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\NewCertificateData;
use App\Modules\Documents\Enums\SubjectType;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateCertificateRequest extends FormRequest
{
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
            'subject_type' => ['required', 'string', Rule::in(SubjectType::values())],
            'subject_id' => ['required', 'uuid'],
            'certificate_type_term_id' => ['required', 'uuid'],
            ...RenewCertificateRequest::fields(),
        ];
    }

    public function toData(): NewCertificateData
    {
        /** @var array<string, mixed> $valeurs */
        $valeurs = $this->validated('values', []) ?? [];

        return new NewCertificateData(
            new DocumentSubject((string) $this->validated('subject_type'), (string) $this->validated('subject_id')),
            (string) $this->validated('certificate_type_term_id'),
            $this->filled('reference') ? (string) $this->validated('reference') : null,
            $this->filled('issuer_party_id') ? (string) $this->validated('issuer_party_id') : null,
            CarbonImmutable::parse((string) $this->validated('issued_on')),
            $this->filled('expires_on') ? CarbonImmutable::parse((string) $this->validated('expires_on')) : null,
            $valeurs,
            $this->filled('stored_file_id') ? (string) $this->validated('stored_file_id') : null,
        );
    }
}
