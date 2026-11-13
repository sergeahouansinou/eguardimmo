<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class MobileTokenRequest extends FormRequest
{
    public const REGLE_APPAREIL = ['required', 'string', 'min:1', 'max:100', 'regex:/^[^\p{C}]+$/u'];

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
            'device_name' => self::REGLE_APPAREIL,
        ];
    }
}
