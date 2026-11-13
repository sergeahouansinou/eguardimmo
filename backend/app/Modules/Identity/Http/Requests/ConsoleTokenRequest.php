<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ConsoleTokenRequest extends FormRequest
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
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'required_without:recovery_code', 'string', 'max:10'],
            'recovery_code' => ['nullable', 'required_without:code', 'string', 'max:64'],
        ];
    }

    public function code(): ?string
    {
        return $this->filled('code') ? (string) $this->string('code') : null;
    }

    public function recoveryCode(): ?string
    {
        return $this->filled('recovery_code') ? (string) $this->string('recovery_code') : null;
    }
}
