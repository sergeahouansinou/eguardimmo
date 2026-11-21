<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Data\LoanTermsData;
use App\Modules\Investments\Data\PrepaymentData;
use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Enums\FeeKind;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Enums\PrepaymentOption;
use App\Modules\Investments\Enums\ScheduleReason;
use App\Modules\Investments\Enums\ScheduleSource;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanFee;
use App\Modules\Investments\Support\AmortizationCalculator;
use App\Modules\Investments\Support\Currencies;
use App\Modules\Investments\Support\FrozenYears;
use App\Modules\Investments\Support\LoanLock;
use App\Modules\Investments\Support\ScheduleWriter;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Remboursement anticipé à une date d'échéance : l'échéance du jour est payée, puis le montant s'impute sur le capital.
 * Nouvelle version de l'échéancier ; un remboursement total solde le prêt. Réservé aux échéanciers calculés : un tableau importé se remplace par un nouvel import.
 */
final readonly class PrepayLoan
{
    public function __construct(
        private LoanLock $verrou,
        private FrozenYears $figees,
        private AmortizationCalculator $calculateur,
        private ScheduleWriter $echeanciers,
        private RecordAudit $audit,
    ) {}

    public function handle(string $loanId, PrepaymentData $d): Loan
    {
        return DB::transaction(function () use ($loanId, $d): Loan {
            $pret = $this->verrou->lock($loanId, $d->lockVersion);
            $this->verrou->assertActive($pret);

            if ($pret->schedule_source !== ScheduleSource::Computed) {
                throw ErrorCode::LoanStateInvalid->problem('Un prêt à échéancier importé se met à jour par un nouvel import.');
            }

            $this->figees->assertEffectiveAfter($pret, $d->date);
            $lignes = $this->echeanciers->latest($pret->id);
            $index = $this->index($lignes, $d->date);
            $ligne = $lignes[$index];

            if ($d->amount > $ligne->outstandingAfter) {
                throw ErrorCode::LoanTermsInvalid->problem('Le remboursement dépasse le capital restant dû.');
            }

            $restant = $ligne->outstandingAfter - $d->amount;
            $avant = array_slice($lignes, 0, $index);
            $anticipee = new ScheduleRowData($ligne->dueOn, $ligne->payment + $d->amount, $ligne->interest, $ligne->principal + $d->amount, $ligne->insurance, $restant);
            $apres = array_slice($lignes, $index + 1);
            $suite = $restant === 0 ? [] : $this->suite($pret, $restant, $index + 1, $apres, $d->option);

            $this->echeanciers->write($pret, [...$avant, $anticipee, ...$suite], ScheduleReason::Prepayment, $d->date);

            if ($d->penalty > 0) {
                LoanFee::query()->create(['loan_id' => $pret->id, 'kind' => FeeKind::PrepaymentPenalty->value, 'paid_on' => $d->date, 'currency' => $pret->currency, 'amount' => Currencies::money($d->penalty, $pret->currency)]);
            }

            $pret->forceFill(['lock_version' => $pret->lock_version + 1, ...($restant === 0 ? ['status' => LoanStatus::Repaid->value, 'repaid_on' => $d->date] : [])])->save();
            $this->audit->handle('investments.loan.prepaid', subject: $pret);

            return $pret;
        });
    }

    /**
     * @param  list<ScheduleRowData>  $lignes
     */
    private function index(array $lignes, string $date): int
    {
        foreach ($lignes as $i => $l) {
            if ($l->dueOn === $date) {
                return $i;
            }
        }

        throw ErrorCode::LoanTermsInvalid->problem('Un remboursement anticipé se fait à une date d\'échéance du tableau.');
    }

    /**
     * @param  list<ScheduleRowData>  $apres
     * @return list<ScheduleRowData>
     */
    private function suite(Loan $pret, int $restant, int $depuis, array $apres, PrepaymentOption $option): array
    {
        if ($apres === []) {
            throw ErrorCode::LoanTermsInvalid->problem('Aucune échéance ne suit cette date : remboursez la totalité du capital restant dû.');
        }

        $termes = new LoanTermsData(
            (int) $pret->principal->getAmount(), $pret->nominal_rate, $pret->first_due_on->toDateString(), $pret->term_months, $pret->deferral_kind,
            $pret->deferral_months, $pret->insurance_mode, $pret->insurance_rate, $pret->insurance_amount === null ? null : (int) $pret->insurance_amount->getAmount(),
        );

        return $this->calculateur->continue($termes, $restant, $depuis, count($apres), $option === PrepaymentOption::ReduceTerm ? $apres[0]->payment : null);
    }
}
