<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RequestContactUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Aucune valeur de coordonnée n'est acceptée du client : elles sont lues sur son compte.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'organization_id' => ['required', 'uuid'],
            'fields' => ['required', 'array', 'min:1', 'max:2'],
            'fields.*' => ['string', 'in:email,phone', 'distinct'],
            'client_id' => ['required', 'uuid'],
        ];
    }

    /**
     * @return list<string>
     */
    public function fields(): array
    {
        /** @var list<string> $champs */
        $champs = array_values((array) $this->validated('fields'));

        return $champs;
    }
}
