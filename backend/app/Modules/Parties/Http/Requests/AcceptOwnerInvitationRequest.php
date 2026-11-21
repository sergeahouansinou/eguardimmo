<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AcceptOwnerInvitationRequest extends FormRequest
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
        return [
            'token' => ['required', 'string', 'size:48', 'alpha_num'],
            'code' => ['required', 'string', 'digits:6'],
            'consent' => ['required', 'accepted'],
        ];
    }
}
