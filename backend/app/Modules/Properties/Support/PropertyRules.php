<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

final class PropertyRules
{
    /**
     * Adresse du site : rue, complément, code postal, ville, pays ISO 3166-1 alpha-2.
     *
     * @return array<string, list<mixed>>
     */
    public static function address(bool $required): array
    {
        return [
            'address' => [$required ? 'required' : 'sometimes', 'array:line1,line2,postal_code,city,country'],
            'address.line1' => ['required_with:address', 'string', 'max:200'],
            'address.line2' => ['nullable', 'string', 'max:200'],
            'address.postal_code' => ['required_with:address', 'string', 'max:20'],
            'address.city' => ['required_with:address', 'string', 'max:100'],
            'address.country' => ['required_with:address', 'string', 'regex:/^[A-Z]{2}$/'],
        ];
    }

    /**
     * @param  array<string, mixed>  $adresse
     * @return array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}
     */
    public static function normalizeAddress(array $adresse): array
    {
        return [
            'line1' => (string) $adresse['line1'],
            'line2' => isset($adresse['line2']) ? (string) $adresse['line2'] : null,
            'postal_code' => (string) $adresse['postal_code'],
            'city' => (string) $adresse['city'],
            'country' => (string) $adresse['country'],
        ];
    }
}
