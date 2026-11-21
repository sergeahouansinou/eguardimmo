<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Data\ReauthenticationData;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Support\ReauthenticationProof;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DeleteAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'password' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:10'],
            'recovery_code' => ['nullable', 'string', 'max:64'],
            'provider' => ['nullable', 'required_with:id_token', Rule::enum(SocialProvider::class)],
            'id_token' => ['nullable', 'required_with:provider', 'string', 'max:8192'],
            'nonce' => ['nullable', 'required_with:id_token', 'string', 'min:16', 'max:255'],
        ];
    }

    public function toData(): ReauthenticationData
    {
        return ReauthenticationProof::fromRequest($this);
    }
}
