<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Data\NewContactPointData;
use App\Modules\Parties\Data\NewIdentifierData;
use App\Modules\Parties\Data\NewPartyData;
use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Enums\IdentifierScheme;
use App\Modules\Parties\Enums\PartyKind;

/**
 * Construit une fiche à créer depuis des champs déjà validés par `PartyRules`.
 */
final class PartyInput
{
    /**
     * @param  array<string, mixed>  $v
     */
    public static function from(array $v, bool $allowDuplicate = false): NewPartyData
    {
        return new NewPartyData(
            kind: PartyKind::from((string) $v['kind']),
            lastName: self::texte($v, 'last_name'),
            firstName: self::texte($v, 'first_name'),
            companyName: self::texte($v, 'company_name'),
            legalFormTermId: self::texte($v, 'legal_form_term_id'),
            birthDate: self::texte($v, 'birth_date'),
            address: self::adresse($v),
            language: is_string($v['language'] ?? null) ? $v['language'] : 'fr',
            customFields: is_array($v['custom_fields'] ?? null) ? $v['custom_fields'] : [],
            categoryIds: array_values(array_map(strval(...), (array) ($v['contact_category_ids'] ?? []))),
            tagIds: array_values(array_map(strval(...), (array) ($v['tag_ids'] ?? []))),
            note: self::texte($v, 'note'),
            contactPoints: self::coordonnees($v),
            identifiers: self::identifiants($v),
            allowDuplicate: $allowDuplicate,
        );
    }

    /**
     * @param  array<string, mixed>  $v
     */
    private static function texte(array $v, string $cle): ?string
    {
        return isset($v[$cle]) && is_string($v[$cle]) && trim($v[$cle]) !== '' ? trim($v[$cle]) : null;
    }

    /**
     * @param  array<string, mixed>  $v
     * @return array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null
     */
    private static function adresse(array $v): ?array
    {
        $adresse = $v['address'] ?? null;

        if (! is_array($adresse) || $adresse === []) {
            return null;
        }

        return [
            'line1' => (string) $adresse['line1'],
            'line2' => isset($adresse['line2']) ? (string) $adresse['line2'] : null,
            'postal_code' => (string) $adresse['postal_code'],
            'city' => (string) $adresse['city'],
            'country' => (string) $adresse['country'],
        ];
    }

    /**
     * @param  array<string, mixed>  $v
     * @return list<NewContactPointData>
     */
    private static function coordonnees(array $v): array
    {
        $points = [];

        foreach ((array) ($v['contact_points'] ?? []) as $ligne) {
            if (is_array($ligne)) {
                $points[] = new NewContactPointData(
                    ContactPointType::from((string) $ligne['type']),
                    (string) $ligne['value'],
                    self::texte($ligne, 'label'),
                    (bool) ($ligne['primary'] ?? false),
                );
            }
        }

        return $points;
    }

    /**
     * @param  array<string, mixed>  $v
     * @return list<NewIdentifierData>
     */
    private static function identifiants(array $v): array
    {
        $identifiants = [];

        foreach ((array) ($v['identifiers'] ?? []) as $ligne) {
            if (is_array($ligne)) {
                $identifiants[] = new NewIdentifierData(IdentifierScheme::from((string) $ligne['scheme']), (string) $ligne['country'], (string) $ligne['value']);
            }
        }

        return $identifiants;
    }
}
