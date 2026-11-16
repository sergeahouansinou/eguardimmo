<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Properties\Data\UnitData;
use Carbon\CarbonInterface;
use Money\Money;

/**
 * Formes JSON partagées. Les parties n'exposent que leur nom, leur nature et leur anonymisation : ni e-mail, ni coordonnées, ni identité bancaire.
 */
final class ApiShapes
{
    /**
     * @return array{amount: int, currency: string}
     */
    public static function money(Money $montant): array
    {
        return ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }

    /**
     * Les périodes se stockent fin exclue ; l'API les expose fin incluse.
     */
    public static function endDate(?CarbonInterface $finExclue): ?string
    {
        return $finExclue?->toImmutable()->subDay()->toDateString();
    }

    /**
     * @return array{id: string, reference: string, property: array{id: string, name: string}}
     */
    public static function unit(UnitData $lot): array
    {
        return ['id' => $lot->id, 'reference' => $lot->reference, 'property' => ['id' => $lot->propertyId, 'name' => $lot->propertyName]];
    }

    /**
     * @return array{id: string, display_name: string, kind: string, is_anonymized: bool}
     */
    public static function party(PartyData $partie): array
    {
        return ['id' => $partie->id, 'display_name' => $partie->displayName, 'kind' => $partie->kind->value, 'is_anonymized' => $partie->isAnonymized];
    }

    /**
     * @return array{id: string, key: string, label: string, semantic_key: string|null}
     */
    public static function component(TermData $terme): array
    {
        return ['id' => $terme->id, 'key' => $terme->key, 'label' => $terme->label(), 'semantic_key' => $terme->semanticKey];
    }
}
