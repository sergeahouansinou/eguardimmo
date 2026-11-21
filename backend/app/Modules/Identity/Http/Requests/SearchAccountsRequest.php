<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class SearchAccountsRequest extends FormRequest
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
            'email' => ['nullable', 'string', 'email:rfc', 'max:254', 'required_without:id', 'prohibits:id'],
            'id' => ['nullable', 'uuid', 'required_without:email', 'prohibits:email'],
        ];
    }
}
