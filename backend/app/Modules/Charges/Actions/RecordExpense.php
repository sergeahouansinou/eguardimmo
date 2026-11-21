<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Data\ExpenseInputData;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Models\ExpenseFile;
use App\Modules\Charges\Support\Currencies;
use App\Modules\Charges\Support\ExpenseAttachments;
use App\Modules\Charges\Support\ExpenseFingerprint;
use App\Modules\Charges\Support\ExpenseLedger;
use App\Modules\Charges\Support\ExpenseRules;
use App\Modules\Charges\Support\Operators;
use App\Modules\Charges\Support\ResolvedExpense;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;

final readonly class RecordExpense
{
    public function __construct(
        private ExpenseRules $regles,
        private ExpenseLedger $ecritures,
        private ExpenseAttachments $pieces,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * Une dépense s'enregistre ou s'annule, sans brouillon. Au-delà du seuil de fonds de tiers, elle attend la validation d'une autre
     * personne habilitée (statut `pending_approval`, aucune écriture). Rejouable par clé d'idempotence.
     *
     * @return array{expense: Expense, replayed: bool}
     */
    public function handle(ExpenseInputData $d): array
    {
        $this->assertAccess($d->settlement, $d->totalGross);

        try {
            return DB::transaction(fn (): array => $this->record($d));
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = Expense::query()->where('idempotency_key', $d->idempotencyKey)->first();

            if ($rejeu !== null) {
                return ['expense' => $this->replay($rejeu, $d), 'replayed' => true];
            }

            if (str_contains($erreur->getMessage(), 'active_fingerprint')) {
                throw ErrorCode::ExpenseDuplicate->problem();
            }

            throw $erreur;
        }
    }

    private function assertAccess(ExpenseSettlement $mode, int $montant): void
    {
        if ($mode->movesThirdPartyFunds()) {
            $this->operateurs->assertRole([MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant]);
            $this->operateurs->assertTwoFactor();
        }

        if ($this->ecritures->needsSecondApproval($mode, $montant)) {
            $this->operateurs->assertRecentTwoFactor();
        }
    }

    /**
     * @return array{expense: Expense, replayed: bool}
     */
    private function record(ExpenseInputData $d): array
    {
        $today = CarbonImmutable::today();
        $resolu = $this->regles->resolve($d, $today);
        $empreinte = ExpenseFingerprint::of($d, $resolu->currency);
        $existante = Expense::query()->where('idempotency_key', $d->idempotencyKey)->first();

        if ($existante !== null) {
            return ['expense' => $this->replay($existante, $d), 'replayed' => true];
        }

        if (Expense::query()->where('active_fingerprint', $empreinte)->exists()) {
            throw ErrorCode::ExpenseDuplicate->problem();
        }

        $depense = $this->create($d, $resolu, $empreinte);
        $attente = $this->ecritures->needsSecondApproval($d->settlement, $d->totalGross);

        if ($d->settlement->postsToLedger() && ! $attente) {
            $depense->forceFill(['ledger_entry_id' => $this->ecritures->post($depense, $resolu->categoryKey)])->save();
        }

        $this->audit->handle('charges.expense.recorded', subject: $depense, metadata: ['settlement' => $d->settlement->value, 'pending_approval' => $attente]);

        return ['expense' => $depense, 'replayed' => false];
    }

    private function create(ExpenseInputData $d, ResolvedExpense $resolu, string $empreinte): Expense
    {
        $id = (string) Str::uuid7();
        $monnaie = Currencies::of($resolu->currency);
        $fichier = $d->document === null ? null : $this->pieces->store($d->document, $id);
        $attente = $this->ecritures->needsSecondApproval($d->settlement, $d->totalGross);
        $depense = new Expense;
        $depense->forceFill([
            'id' => $id,
            'property_id' => $d->propertyId,
            'unit_id' => $d->unitId,
            'kind' => $d->kind,
            'category_term_id' => $d->categoryTermId,
            'payee_party_id' => $d->payeePartyId,
            'payee_label' => $d->payeeLabel === null ? null : trim($d->payeeLabel),
            'reference' => $d->reference,
            'document_on' => $d->documentOn,
            'service_from' => $d->serviceFrom,
            'service_to' => $d->serviceTo,
            'currency' => $resolu->currency,
            'total_gross' => new Money($d->totalGross, $monnaie),
            'tax_amount' => new Money($d->taxAmount, $monnaie),
            'recoverable_amount' => new Money($d->recoverableAmount, $monnaie),
            'recoverable_rubric' => $d->recoverableAmount > 0 ? $d->recoverableRubric : null,
            'settlement' => $d->settlement,
            'paid_on' => $d->settlement->postsToLedger() || $d->settlement === ExpenseSettlement::PaidByOwner ? ($d->paidOn ?? $d->documentOn) : null,
            'mandate_id' => $resolu->mandateId,
            'mandant_party_id' => $resolu->mandantPartyId,
            'stored_file_id' => $fichier,
            'fingerprint' => $empreinte,
            'active_fingerprint' => $empreinte,
            'status' => $attente ? ExpenseStatus::PendingApproval : ExpenseStatus::Recorded,
            'idempotency_key' => $d->idempotencyKey,
            'lock_version' => 1,
            'created_by_user_id' => $this->operateurs->userId(),
        ])->save();

        if ($fichier !== null) {
            ExpenseFile::query()->create(['expense_id' => $id, 'stored_file_id' => $fichier, 'created_by_user_id' => $this->operateurs->userId()]);
        }

        return $depense;
    }

    private function replay(Expense $existante, ExpenseInputData $d): Expense
    {
        if (! hash_equals($existante->fingerprint, ExpenseFingerprint::of($d, $existante->currency))) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existante;
    }
}
