<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AcceptSuggestionsRequest extends FormRequest
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
            'suggestion_ids' => ['required', 'array', 'min:1', 'max:50'],
            'suggestion_ids.*' => ['uuid', 'distinct'],
        ];
    }
}
