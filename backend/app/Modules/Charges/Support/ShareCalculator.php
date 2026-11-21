<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use InvalidArgumentException;
use Money\Money;

/**
 * Fonction pure de répartition (ADR 0034 § 5) : entiers et moneyphp, jamais de flottant. La part d'un bail pour un poste est
 * `montant × Σ(poids du lot × jours occupés) / (dénominateur × jours de la période)`, arrondie à l'unité mineure inférieure :
 * le reste, vacance et forfait compris, reste au propriétaire.
 */
final class ShareCalculator
{
    public function share(Money $amount, int $weightedDays, int $denominator, int $periodDays): Money
    {
        if ($denominator <= 0 || $periodDays <= 0 || $weightedDays < 0) {
            throw new InvalidArgumentException('Dénominateur, durée ou poids invalide.');
        }

        return $amount->multiply((string) $weightedDays)->divide((string) ($denominator * $periodDays), Money::ROUND_DOWN);
    }

    /**
     * @param  array<string, int>  $weightedDaysByLease  Σ(poids × jours) par bail
     */
    public function split(Money $amount, int $denominator, int $periodDays, array $weightedDaysByLease): ShareSplit
    {
        $parts = [];
        $total = new Money(0, $amount->getCurrency());

        foreach ($weightedDaysByLease as $leaseId => $poidsJours) {
            $part = $this->share($amount, $poidsJours, $denominator, $periodDays);
            $parts[$leaseId] = $part;
            $total = $total->add($part);
        }

        return new ShareSplit($parts, $amount->subtract($total));
    }

    /**
     * Provision mensuelle suggérée : un douzième, arrondi au demi supérieur.
     */
    public function suggestedMonthly(Money $total): Money
    {
        return $total->divide(12, Money::ROUND_HALF_UP);
    }

    /**
     * Douze mensualités ; l'écart d'arrondi est porté par la dernière.
     *
     * @return list<Money>
     */
    public function twelfths(Money $balance): array
    {
        $mensualite = $balance->divide(12, Money::ROUND_DOWN);
        $lignes = array_fill(0, 11, $mensualite);
        $lignes[] = $balance->subtract($mensualite->multiply(11));

        return $lignes;
    }
}
