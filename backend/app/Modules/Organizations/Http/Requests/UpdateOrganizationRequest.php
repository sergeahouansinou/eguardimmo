<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Support\OrganizationTimezone;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateOrganizationRequest extends FormRequest
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
            'timezone' => ['required', 'string', 'max:64', fn (string $attribut, mixed $valeur, callable $echec): mixed => is_string($valeur) && OrganizationTimezone::isValid($valeur) ? null : $echec('Ce fuseau horaire est inconnu (identifiant IANA attendu, par exemple Europe/Paris).')],
        ];
    }

    public function timezone(): string
    {
        return (string) $this->validated('timezone');
    }
}
