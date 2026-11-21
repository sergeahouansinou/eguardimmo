<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Properties\Data\UnitData;
use Carbon\CarbonInterface;
use Money\Money;

/**
 * Formes JSON partagées. Le mandant n'expose que son nom, sa nature et son anonymisation : ni e-mail, ni coordonnées, ni identité bancaire.
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
    public static function type(TermData $terme): array
    {
        return ['id' => $terme->id, 'key' => $terme->key, 'label' => $terme->label(), 'semantic_key' => $terme->semanticKey];
    }

    /**
     * @param  array<string, UnitData>  $lots
     * @return array<string, mixed>
     */
    public static function line(MandateUnit $ligne, array $lots): array
    {
        return [
            'id' => $ligne->id,
            'unit' => isset($lots[$ligne->unit_id]) ? self::unit($lots[$ligne->unit_id]) : null,
            'valid_from' => $ligne->valid_from->toDateString(),
            'end_date' => self::endDate($ligne->valid_to),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function terms(MandateTerm $terme): array
    {
        return [
            'id' => $terme->id,
            'fee_kind' => $terme->fee_kind->value,
            'fee_basis_points' => $terme->fee_basis_points,
            'fee_flat_amount' => $terme->fee_flat_amount === null ? null : self::money($terme->fee_flat_amount),
            'payout_day' => $terme->payout_day,
            'works_limit_amount' => self::money($terme->works_limit_amount),
            'fee_base' => $terme->fee_base?->value,
            'fee_minimum_amount' => self::money($terme->fee_minimum_amount),
            'fee_tax_mode' => $terme->fee_tax_mode->value,
            'letting_fee_basis_points' => $terme->letting_fee_basis_points,
            'works_fee_basis_points' => $terme->works_fee_basis_points,
            'signed_file_id' => $terme->signed_file_id,
            'valid_from' => $terme->valid_from->toDateString(),
            'valid_to' => $terme->valid_to?->toDateString(),
            'reason' => $terme->reason->value,
        ];
    }
}
