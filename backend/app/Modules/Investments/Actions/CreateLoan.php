<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Data\NewLoanData;
use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Enums\InsuranceMode;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Enums\ScheduleReason;
use App\Modules\Investments\Enums\ScheduleSource;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Support\AmortizationCalculator;
use App\Modules\Investments\Support\Attachments;
use App\Modules\Investments\Support\Currencies;
use App\Modules\Investments\Support\Fingerprint;
use App\Modules\Investments\Support\ScheduleWriter;
use App\Modules\Investments\Support\Scopes;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CreateLoan
{
    public function __construct(
        private Scopes $portees,
        private Attachments $pieces,
        private AmortizationCalculator $calculateur,
        private ScheduleWriter $echeanciers,
        private OrganizationDirectory $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * @return array{loan: Loan, replayed: bool}
     */
    public function handle(NewLoanData $d): array
    {
        $this->assertTerms($d);
        $empreinte = Fingerprint::of($d->content());

        return DB::transaction(function () use ($d, $empreinte): array {
            $existant = Loan::query()->where('idempotency_key', $d->idempotencyKey)->lockForUpdate()->first();

            if ($existant !== null) {
                return hash_equals($existant->fingerprint, $empreinte) ? ['loan' => $existant, 'replayed' => true] : throw ErrorCode::IdempotencyKeyReused->problem();
            }

            $this->portees->assert($d->propertyId, $d->unitId);

            if ($d->replacesLoanId !== null && ! Loan::query()->whereKey($d->replacesLoanId)->where('property_id', $d->propertyId)->where('status', '!=', LoanStatus::Voided->value)->exists()) {
                throw ErrorCode::LoanNotFound->problem();
            }

            $t = $d->terms;
            $devise = $this->organisation->currency()->getCode();
            $id = (new Loan)->newUniqueId();
            $pret = new Loan([
                'property_id' => $d->propertyId,
                'unit_id' => $d->unitId,
                'lender_label' => $d->lenderLabel,
                'contract_reference' => $d->contractReference,
                'purpose' => $d->purpose->value,
                'currency' => $devise,
                'principal' => Currencies::money($t->principal, $devise),
                'nominal_rate' => $t->annualRate,
                'first_due_on' => $t->firstDueOn,
                'term_months' => $t->termMonths,
                'deferral_kind' => $t->deferralKind->value,
                'deferral_months' => $t->deferralMonths,
                'insurance_mode' => $t->insuranceMode->value,
                'insurance_rate' => $t->insuranceRate,
                'insurance_amount' => $t->insuranceAmount === null ? null : Currencies::money($t->insuranceAmount, $devise),
                'replaces_loan_id' => $d->replacesLoanId,
                'schedule_source' => ScheduleSource::Computed->value,
                'status' => LoanStatus::Active->value,
                'idempotency_key' => $d->idempotencyKey,
                'fingerprint' => $empreinte,
                'lock_version' => 1,
                'stored_file_id' => $d->document === null ? null : $this->pieces->store($d->document, 'loan', $id),
            ]);
            $pret->id = $id;
            $pret->save();

            $this->echeanciers->write($pret, $this->calculateur->compute($t), ScheduleReason::Initial, $t->firstDueOn);

            $this->audit->handle('investments.loan.created', subject: $pret);

            return ['loan' => $pret, 'replayed' => false];
        });
    }

    private function assertTerms(NewLoanData $d): void
    {
        $t = $d->terms;
        $max = (int) config('investments.principal_max_minor');
        $differe = $t->deferralKind !== DeferralKind::None;

        $coherent = $t->principal >= 1 && $t->principal <= $max
            && $t->termMonths >= 1 && $t->termMonths <= (int) config('investments.term_max_months')
            && ($differe ? $t->deferralMonths >= 1 && $t->deferralMonths < $t->termMonths : $t->deferralMonths === 0)
            && match ($t->insuranceMode) {
                InsuranceMode::None => $t->insuranceRate === null && $t->insuranceAmount === null,
                InsuranceMode::Fixed => $t->insuranceRate === null && $t->insuranceAmount !== null && $t->insuranceAmount >= 0 && $t->insuranceAmount <= $max,
                default => $t->insuranceRate !== null && $t->insuranceAmount === null,
            };

        if (! $coherent) {
            throw ErrorCode::LoanTermsInvalid->problem();
        }
    }
}
