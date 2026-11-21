<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class InviteTenantAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return ['email' => ['nullable', 'string', 'email:rfc', 'max:254']];
    }

    public function email(): ?string
    {
        return $this->filled('email') ? mb_strtolower(trim((string) $this->validated('email'))) : null;
    }
}
