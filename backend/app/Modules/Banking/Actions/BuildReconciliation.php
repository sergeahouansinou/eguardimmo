<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Banking\Support\ReconciliationCalculator;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Money\Currency;
use Money\Money;

/**
 * État de rapprochement d'un compte à la fin d'un mois : brouillon recalculable tant qu'il n'est pas validé. Un état déjà validé
 * et à jour est rendu tel quel ; un état périmé est remplacé par un nouveau brouillon qui le référence (`supersedes_id`).
 */
final readonly class BuildReconciliation
{
    public function __construct(
        private ReconciliationCalculator $calcul,
        private Idempotency $idempotence,
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * @return array{reconciliation: BankReconciliation, replayed: bool}
     */
    public function handle(string $accountId, CarbonImmutable $month, ?int $bankBalance, ?string $proofPath, string $userId, string $cle): array
    {
        $asOf = $month->endOfMonth()->startOfDay();
        $empreinte = hash('sha256', (string) json_encode(['reconciliation', $accountId, $asOf->toDateString(), $bankBalance, $proofPath === null ? null : hash_file('sha256', $proofPath)]));

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($accountId, $asOf, $bankBalance, $proofPath, $userId): array {
            $compte = OrganizationBankAccount::query()->lockForUpdate()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

            if ($compte->status !== AccountStatus::Active && ! ($compte->closed_at !== null && $compte->closed_at->startOfDay()->greaterThan($asOf))) {
                throw ErrorCode::AccountClosed->problem();
            }

            if ($asOf->lessThan($compte->reconciliation_from->toDateString())) {
                throw ErrorCode::ReconciliationNotActionable->problem('Le mois précède le début du suivi du compte.');
            }

            $chiffres = $this->calcul->compute($compte, $asOf, $bankBalance);
            $valide = BankReconciliation::query()->where('bank_account_id', $accountId)->whereDate('as_of', $asOf->toDateString())->where('status', ReconciliationStatus::Validated)->first();

            if ($valide !== null && $valide->ledger_version === $chiffres->freshness) {
                return ['type' => 'bank_reconciliation', 'id' => $valide->id];
            }

            if ($chiffres->source === 'entered' && $proofPath === null) {
                throw ErrorCode::ReconciliationProofRequired->problem();
            }

            BankReconciliation::query()->where('bank_account_id', $accountId)->whereDate('as_of', $asOf->toDateString())->where('status', ReconciliationStatus::Draft)->delete();

            $devise = new Currency($compte->currency);
            $etat = BankReconciliation::query()->create([
                'bank_account_id' => $accountId, 'as_of' => $asOf, 'currency' => $compte->currency, 'bank_balance_source' => $chiffres->source,
                'bank_balance' => new Money($chiffres->bankBalance, $devise), 'book_balance' => new Money($chiffres->bookBalance, $devise),
                'unmatched_lines_total' => new Money($chiffres->unmatchedLines, $devise), 'unmatched_entries_total' => new Money($chiffres->unmatchedEntries, $devise),
                'ignored_total' => new Money($chiffres->ignored, $devise), 'timing_difference' => new Money($chiffres->timing, $devise),
                'unexplained_difference' => new Money($chiffres->unexplained, $devise), 'items' => $chiffres->items, 'ledger_version' => $chiffres->freshness,
                'status' => ReconciliationStatus::Draft, 'supersedes_id' => $valide?->id, 'created_by_user_id' => $userId,
            ]);

            if ($proofPath !== null && $chiffres->source === 'entered') {
                $preuve = $this->documents->store(
                    FileSource::path($proofPath), 'solde-'.$asOf->format('Ymd').'.pdf', FileCategory::Supporting, new DocumentSubject('bank_reconciliation', $etat->id),
                    CarbonImmutable::now()->addYears((int) config('banking.retention_years')),
                );
                $etat->forceFill(['balance_proof_file_id' => $preuve->id])->save();
            }

            $this->audit->handle('banking.reconciliation.built', subject: $etat, metadata: ['bank_account_id' => $accountId, 'as_of' => $asOf->toDateString(), 'balance_source' => $chiffres->source, 'with_proof' => $proofPath !== null && $chiffres->source === 'entered']);

            return ['type' => 'bank_reconciliation', 'id' => $etat->id];
        });

        return ['reconciliation' => BankReconciliation::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
