<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\LineSemantic;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Appel d'une période depuis les lignes de composantes du bail : un tronçon par mois civil et par ligne en vigueur,
 * au prorata des jours réellement occupés (bail qui commence ou finit en cours de mois, révision en cours de mois).
 */
final class DraftBuilder
{
    private const array MOIS = [
        1 => 'janvier', 2 => 'février', 3 => 'mars', 4 => 'avril', 5 => 'mai', 6 => 'juin', 7 => 'juillet', 8 => 'août',
        9 => 'septembre', 10 => 'octobre', 11 => 'novembre', 12 => 'décembre',
    ];

    /**
     * @param  list<LeaseTermLineData>  $termes  lignes en vigueur sur la période
     */
    public function build(LeaseBillingData $bail, CarbonImmutable $debut, CarbonImmutable $finExclue, array $termes): ?InstallmentDraft
    {
        $occupeDu = $debut->greaterThan($bail->startsOn) ? $debut : CarbonImmutable::parse($bail->startsOn)->startOfDay();
        $fin = $bail->effectiveEndsOn === null ? $finExclue : CarbonImmutable::parse($bail->effectiveEndsOn)->startOfDay();
        $occupeAu = $fin->lessThan($finExclue) ? $fin : $finExclue;

        if ($occupeDu->greaterThanOrEqualTo($occupeAu)) {
            return null;
        }

        $devise = Currencies::of($bail->currency);
        $lignes = [];

        for ($mois = $debut->startOfMonth(); $mois->lessThan($finExclue); $mois = $mois->addMonthNoOverflow()) {
            array_push($lignes, ...$this->month($mois, $occupeDu, $occupeAu, $termes));
        }

        if ($lignes === []) {
            return null;
        }

        $zero = new Money(0, $devise);
        $loyer = $charges = $tva = $zero;

        foreach ($lignes as $ligne) {
            $loyer = $ligne->isRent() ? $loyer->add($ligne->amount) : $loyer;
            $charges = $ligne->isRent() ? $charges : $charges->add($ligne->amount);
            $tva = $tva->add($ligne->vat);
        }

        $total = $loyer->add($charges)->add($tva);

        return $total->isPositive() ? new InstallmentDraft($debut, $finExclue->subDay(), $occupeDu, $lignes, $loyer, $charges, $tva, $total) : null;
    }

    /**
     * @param  list<LeaseTermLineData>  $termes
     * @return list<DraftLine>
     */
    private function month(CarbonImmutable $mois, CarbonImmutable $occupeDu, CarbonImmutable $occupeAu, array $termes): array
    {
        $suivant = $mois->addMonthNoOverflow();
        $joursDuMois = BillingCalendar::days($mois, $suivant);
        $du = $mois->greaterThan($occupeDu) ? $mois : $occupeDu;
        $au = $suivant->lessThan($occupeAu) ? $suivant : $occupeAu;
        $lignes = [];

        if ($du->greaterThanOrEqualTo($au)) {
            return [];
        }

        foreach ($termes as $terme) {
            $semantique = $terme->semantic ?? throw ErrorCode::ComponentUnclassified->problem();

            if ($semantique === LeaseComponentSemantic::Deposit) {
                continue;
            }

            $debutTroncon = CarbonImmutable::parse($terme->validFrom)->startOfDay();
            $finTroncon = $terme->validTo === null ? $au : CarbonImmutable::parse($terme->validTo)->startOfDay();
            $de = $du->greaterThan($debutTroncon) ? $du : $debutTroncon;
            $a = $au->lessThan($finTroncon) ? $au : $finTroncon;

            if ($de->greaterThanOrEqualTo($a)) {
                continue;
            }

            $jours = BillingCalendar::days($de, $a);
            $montant = Proration::amount($terme->amount, $jours, $joursDuMois);

            if (! $montant->isPositive()) {
                continue;
            }

            $lignes[] = new DraftLine(
                $terme->componentKey,
                LineSemantic::ofComponent($semantique),
                $this->label($semantique, $terme->componentKey, $mois, $de, $a, $jours, $joursDuMois),
                $de,
                $a->subDay(),
                $jours,
                $joursDuMois,
                $terme->amount,
                $montant,
                $terme->vatBp,
                Proration::vat($montant, $terme->vatBp),
            );
        }

        return $lignes;
    }

    private function label(LeaseComponentSemantic $semantique, string $cle, CarbonImmutable $mois, CarbonImmutable $de, CarbonImmutable $a, int $jours, int $joursDuMois): string
    {
        $nom = match ($semantique) {
            LeaseComponentSemantic::Rent => 'Loyer',
            LeaseComponentSemantic::RentSupplement => 'Complément de loyer',
            LeaseComponentSemantic::ChargesProvision => 'Provision sur charges',
            LeaseComponentSemantic::ChargesFlat => 'Charges au forfait',
            LeaseComponentSemantic::TaxRecoverable => 'Taxes récupérables',
            LeaseComponentSemantic::Deposit => $cle,
        };
        $periode = self::MOIS[$mois->month].' '.$mois->year;

        return $jours === $joursDuMois
            ? "{$nom} de {$periode}"
            : sprintf('%s du %s au %s %s (%d/%d jours)', $nom, $de->day, $a->subDay()->day, $periode, $jours, $joursDuMois);
    }
}
