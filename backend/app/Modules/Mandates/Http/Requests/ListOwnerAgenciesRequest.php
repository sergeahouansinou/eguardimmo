<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Enums\ErrorCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

final class ListOwnerAgenciesRequest extends FormRequest
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
        return ['agency' => ['sometimes', 'string']];
    }

    /**
     * Restreint seulement ; un identifiant mal formé est une agence inconnue (404), comme un identifiant hors de la clé.
     */
    public function agency(): ?string
    {
        if (! $this->has('agency')) {
            return null;
        }

        $agence = (string) $this->validated('agency');

        return Str::isUuid($agence) ? strtolower($agence) : throw ErrorCode::OwnerAgencyNotFound->problem();
    }
}
