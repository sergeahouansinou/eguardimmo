<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\OwnerFunds\Data\FeeResultData;
use App\Modules\OwnerFunds\Data\FeeSegmentData;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use Money\Currency;
use Money\Money;

/**
 * Honoraires de gestion d'un mandat pour un mois (ADR 0031, décision 3) : fonction pure en entiers (moneyphp), arrondi
 * au demi supérieur. Le dernier barème du mois porte le minimum, le forfait et le mode de taxe.
 */
final readonly class FeeCalculator
{
    private const int DIVISEUR_BP = 10_000;

    private const int DIVISEUR_TAUX = 100_000;

    /**
     * @param  non-empty-list<FeeSegmentData>  $segments  du plus ancien au plus récent barème
     * @param  int  $ratePcm  taux de TVA du jour de la facture, en cent-millièmes (0 en franchise)
     */
    public function compute(array $segments, int $ratePcm, Currency $devise): FeeResultData
    {
        $rent = array_sum(array_map(fn (FeeSegmentData $s): int => $s->rent, $segments));
        $charges = array_sum(array_map(fn (FeeSegmentData $s): int => $s->charges, $segments));
        $dernier = $segments[array_key_last($segments)]->term;
        $honoraires = new Money(0, $devise);
        $base = 0;
        $forfait = null;

        foreach ($segments as $segment) {
            $assiette = $segment->rent + ($this->base($segment) === FeeBase::RentAndCharges ? $segment->charges : 0);
            $base += $assiette;

            if ($segment->term->feeKind === FeeKind::Flat) {
                $forfait = $segment->term->feeFlatAmount;

                continue;
            }

            $points = $segment->term->feeBasisPoints ?? 0;
            $honoraires = $honoraires->add((new Money($assiette, $devise))->multiply($points)->divide(self::DIVISEUR_BP));
        }

        if ($forfait !== null && $base > 0) {
            $honoraires = $honoraires->add(new Money($forfait, $devise));
        }

        $minimum = $dernier->feeMinimumAmount;
        $minimumApplique = $honoraires->isPositive() && $honoraires->lessThan(new Money($minimum, $devise));

        if ($minimumApplique) {
            $honoraires = new Money($minimum, $devise);
        }

        [$net, $taxe] = $this->split($honoraires, $dernier->feeTaxMode, $ratePcm, $devise);

        return new FeeResultData(
            $rent,
            $charges,
            (int) $net->getAmount(),
            (int) $taxe->getAmount(),
            (int) $net->add($taxe)->getAmount(),
            $minimumApplique,
            array_values(array_unique(array_map(fn (FeeSegmentData $s): string => $s->term->id, $segments))),
            $dernier,
        );
    }

    private function base(FeeSegmentData $segment): FeeBase
    {
        if ($segment->rent === 0 && $segment->charges === 0) {
            return FeeBase::Rent;
        }

        return $segment->term->feeBase ?? throw ErrorCode::FeeBaseMissing->problem();
    }

    /**
     * @return array{0: Money, 1: Money} net et taxe
     */
    private function split(Money $honoraires, FeeTaxMode $mode, int $ratePcm, Currency $devise): array
    {
        if ($mode === FeeTaxMode::InclTax) {
            $net = $honoraires->multiply(self::DIVISEUR_TAUX)->divide(self::DIVISEUR_TAUX + $ratePcm);

            return [$net, $honoraires->subtract($net)];
        }

        return [$honoraires, $honoraires->multiply($ratePcm)->divide(self::DIVISEUR_TAUX)];
    }
}
