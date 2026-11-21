<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Banking\Support\ReconciliationCalculator;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Validation d'un état : écart inexpliqué nul et aucun trou de relevé jusqu'à la date, sur des chiffres recalculés sous verrou du compte.
 * L'état est ensuite figé (déclencheur) ; celui qu'il remplace passe à `superseded`.
 */
final readonly class ValidateReconciliation
{
    public function __construct(private ReconciliationCalculator $calcul, private Idempotency $idempotence, private RecordAudit $audit) {}

    /**
     * @return array{reconciliation: BankReconciliation, replayed: bool}
     */
    public function handle(string $reconciliationId, string $userId, string $cle): array
    {
        $empreinte = hash('sha256', 'validate-reconciliation|'.$reconciliationId);

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($reconciliationId, $userId): array {
            $apercu = BankReconciliation::query()->find($reconciliationId) ?? throw ErrorCode::ReconciliationNotFound->problem();
            $compte = OrganizationBankAccount::query()->lockForUpdate()->findOrFail($apercu->bank_account_id);
            $etat = BankReconciliation::query()->lockForUpdate()->findOrFail($reconciliationId);

            if ($etat->status !== ReconciliationStatus::Draft) {
                throw ErrorCode::ReconciliationNotActionable->problem();
            }

            $saisi = $etat->bank_balance_source === 'entered' ? (int) $etat->bank_balance->getAmount() : null;
            $chiffres = $this->calcul->compute($compte, CarbonImmutable::parse($etat->as_of->toDateString()), $saisi);

            if ($chiffres->freshness !== $etat->ledger_version) {
                throw ErrorCode::ReconciliationNotActionable->problem('Les données ont changé depuis le calcul : recalculez l\'état.');
            }

            if ($chiffres->gaps !== []) {
                throw ErrorCode::StatementGap->problem();
            }

            if ($chiffres->unexplained !== 0) {
                throw ErrorCode::ReconciliationUnexplainedDifference->problem();
            }

            BankReconciliation::query()->where('bank_account_id', $compte->id)->whereDate('as_of', $etat->as_of->toDateString())
                ->where('status', ReconciliationStatus::Validated)->where('id', '<>', $etat->id)->update(['status' => ReconciliationStatus::Superseded->value, 'updated_at' => now()]);

            $etat->forceFill(['status' => ReconciliationStatus::Validated, 'validated_by_user_id' => $userId, 'validated_at' => now()])->save();
            DB::table('bank_suggestions')->whereIn('statement_line_id', DB::table('bank_statement_lines')->where('bank_account_id', $compte->id)->where('booking_date', '<=', $etat->as_of->toDateString())->select('id'))->delete();
            $this->audit->handle('banking.reconciliation.validated', subject: $etat, metadata: ['bank_account_id' => $compte->id, 'as_of' => $etat->as_of->toDateString()]);

            return ['type' => 'bank_reconciliation', 'id' => $etat->id];
        });

        return ['reconciliation' => BankReconciliation::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
