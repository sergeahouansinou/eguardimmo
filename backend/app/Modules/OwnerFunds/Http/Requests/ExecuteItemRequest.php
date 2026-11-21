<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ExecuteItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * La référence bancaire ne porte aucune donnée personnelle : caractères de référence seulement.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'executed_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'reference' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9._\/-]+$/'],
            'acknowledge_account_change' => ['sometimes', 'boolean'],
        ];
    }
}
