<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use Money\Money;

final class Proration
{
    /**
     * Mois entier : le montant mensuel. Sinon montant × jours réels / jours réels du mois, arrondi à l'unité mineure de
     * la devise, demi vers le haut (un XOF n'a pas de décimales, un EUR a des centimes).
     */
    public static function amount(Money $mensuel, int $jours, int $joursDuMois): Money
    {
        if ($jours === $joursDuMois) {
            return $mensuel;
        }

        return $mensuel->multiply($jours)->divide($joursDuMois, Money::ROUND_HALF_UP);
    }

    public static function vat(Money $montant, int $tauxEnPointsDeBase): Money
    {
        return $tauxEnPointsDeBase === 0 ? $montant->multiply(0) : $montant->multiply($tauxEnPointsDeBase)->divide(10000, Money::ROUND_HALF_UP);
    }
}
