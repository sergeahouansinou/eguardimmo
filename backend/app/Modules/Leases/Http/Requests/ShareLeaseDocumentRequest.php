<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Enums\LeaseDocumentKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ShareLeaseDocumentRequest extends FormRequest
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
            'stored_file_id' => ['required', 'uuid'],
            'kind' => ['required', Rule::enum(LeaseDocumentKind::class)],
            'party_id' => ['nullable', 'uuid'],
        ];
    }

    public function kind(): LeaseDocumentKind
    {
        return LeaseDocumentKind::from((string) $this->validated('kind'));
    }

    public function partyId(): ?string
    {
        return $this->filled('party_id') ? (string) $this->validated('party_id') : null;
    }
}
