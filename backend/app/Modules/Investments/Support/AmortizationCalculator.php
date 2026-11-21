<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Investments\Data\LoanTermsData;
use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Enums\InsuranceMode;
use Carbon\CarbonImmutable;

/**
 * Tableau d'amortissement : fonction pure, entiers en unités mineures, taux en décimal BCMath. Taux périodique = taux nominal / 12.
 * Les intérêts de chaque échéance sont arrondis au demi supérieur ; la dernière échéance absorbe l'écart pour finir à zéro.
 */
final class AmortizationCalculator
{
    private const int SCALE = 20;

    /**
     * @return list<ScheduleRowData>
     */
    public function compute(LoanTermsData $t): array
    {
        $rows = [];
        $outstanding = $t->principal;
        $deferral = $t->deferralKind === DeferralKind::None ? 0 : $t->deferralMonths;

        for ($i = 0; $i < $deferral; $i++) {
            $interest = $this->interest($outstanding, $t->annualRate);
            $insurance = $this->insurance($t, $outstanding);
            $partial = $t->deferralKind === DeferralKind::Partial;
            $outstanding += $partial ? 0 : $interest;
            $rows[] = new ScheduleRowData($this->dueOn($t->firstDueOn, $i), $partial ? $interest : 0, $interest, 0, $insurance, $outstanding);
        }

        return [...$rows, ...$this->annuity($t, $outstanding, $deferral, $t->termMonths - $deferral, null)];
    }

    /**
     * Échéances restantes après un remboursement anticipé : `$fixedPayment` conserve la mensualité (la durée raccourcit),
     * sans elle la mensualité est recalculée sur les `$count` échéances restantes.
     *
     * @return list<ScheduleRowData>
     */
    public function continue(LoanTermsData $t, int $outstanding, int $fromIndex, int $count, ?int $fixedPayment): array
    {
        return $this->annuity($t, $outstanding, $fromIndex, $count, $fixedPayment);
    }

    public function payment(int $outstanding, string $annualRate, int $count): int
    {
        if ($count < 1) {
            throw ErrorCode::LoanTermsInvalid->problem('Il faut au moins une échéance.');
        }

        if (bccomp($this->num($annualRate), '0', self::SCALE) === 0) {
            return $this->roundHalfUp(bcdiv((string) $outstanding, (string) $count, self::SCALE));
        }

        $r = $this->periodic($annualRate);
        $growth = bcpow(bcadd('1', $r, self::SCALE), (string) $count, self::SCALE);
        $numerator = bcmul(bcmul((string) $outstanding, $r, self::SCALE), $growth, self::SCALE);

        return $this->roundHalfUp(bcdiv($numerator, bcsub($growth, '1', self::SCALE), self::SCALE));
    }

    /**
     * @return list<ScheduleRowData>
     */
    private function annuity(LoanTermsData $t, int $outstanding, int $fromIndex, int $count, ?int $fixedPayment): array
    {
        if ($outstanding <= 0) {
            return [];
        }

        $payment = $fixedPayment ?? $this->payment($outstanding, $t->annualRate, $count);
        $limit = $fixedPayment === null ? $count : (int) config('investments.term_max_months');
        $rows = [];

        for ($k = 0; $k < $limit && $outstanding > 0; $k++) {
            $interest = $this->interest($outstanding, $t->annualRate);
            $insurance = $this->insurance($t, $outstanding);
            $last = $fixedPayment === null && $k === $count - 1;
            $principal = $last || $payment - $interest >= $outstanding ? $outstanding : max(0, $payment - $interest);

            if ($fixedPayment !== null && $payment <= $interest) {
                throw ErrorCode::LoanTermsInvalid->problem('La mensualité ne couvre pas les intérêts.');
            }

            $outstanding -= $principal;
            $rows[] = new ScheduleRowData($this->dueOn($t->firstDueOn, $fromIndex + $k), $interest + $principal, $interest, $principal, $insurance, $outstanding);
        }

        return $rows;
    }

    /**
     * Calcul exact sur le taux en entier (cinq décimales) : un intérêt qui tombe sur 0,5 s'arrondit toujours vers le haut.
     */
    private function interest(int $outstanding, string $annualRate): int
    {
        return (int) bcdiv(bcadd(bcmul((string) $outstanding, $this->scaled($annualRate)), '60000000'), '120000000', 0);
    }

    /**
     * @return numeric-string taux nominal annuel multiplié par 100 000
     */
    private function scaled(string $annualRate): string
    {
        if (preg_match('/^(\d{1,3})(?:\.(\d{1,5}))?$/', $annualRate, $m) !== 1) {
            throw ErrorCode::LoanTermsInvalid->problem('Taux invalide : cinq décimales au plus.');
        }

        return (string) (int) ($m[1].str_pad($m[2] ?? '', 5, '0'));
    }

    private function insurance(LoanTermsData $t, int $outstanding): int
    {
        return match ($t->insuranceMode) {
            InsuranceMode::None => 0,
            InsuranceMode::Fixed => $t->insuranceAmount ?? 0,
            InsuranceMode::InitialCapital => $this->interest($t->principal, $t->insuranceRate ?? '0'),
            InsuranceMode::OutstandingCapital => $this->interest($outstanding, $t->insuranceRate ?? '0'),
        };
    }

    /**
     * @return numeric-string
     */
    private function num(string $valeur): string
    {
        return is_numeric($valeur) ? $valeur : throw ErrorCode::LoanTermsInvalid->problem('Taux invalide.');
    }

    /**
     * @return numeric-string
     */
    private function periodic(string $annualRate): string
    {
        return bcdiv($this->num($annualRate), '1200', self::SCALE);
    }

    /**
     * @param  numeric-string  $value
     */
    private function roundHalfUp(string $value): int
    {
        return (int) bcadd(bcadd($value, '0.5', self::SCALE), '0', 0);
    }

    private function dueOn(string $firstDueOn, int $index): string
    {
        return CarbonImmutable::parse($firstDueOn)->addMonthsNoOverflow($index)->toDateString();
    }
}
