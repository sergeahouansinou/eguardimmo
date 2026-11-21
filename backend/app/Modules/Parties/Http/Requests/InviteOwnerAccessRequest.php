<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Identity\Enums\OwnerAccessRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class InviteOwnerAccessRequest extends FormRequest
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
            'role' => ['required', 'string', Rule::enum(OwnerAccessRole::class)],
            'person_party_id' => ['nullable', 'uuid'],
            'email' => ['nullable', 'string', 'email:rfc', 'max:254'],
            'identity_verified' => ['sometimes', 'boolean'],
            'powers_verified' => ['sometimes', 'boolean'],
        ];
    }

    public function role(): OwnerAccessRole
    {
        return OwnerAccessRole::from((string) $this->validated('role'));
    }

    public function personPartyId(): ?string
    {
        return $this->filled('person_party_id') ? mb_strtolower((string) $this->validated('person_party_id')) : null;
    }

    public function email(): ?string
    {
        return $this->filled('email') ? mb_strtolower(trim((string) $this->validated('email'))) : null;
    }
}
