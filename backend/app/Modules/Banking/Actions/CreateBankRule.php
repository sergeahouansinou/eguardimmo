<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Data\BankRuleData;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\RuleAction;
use App\Modules\Banking\Models\BankRule;
use App\Modules\Banking\Models\BankStatementLine;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Règle de l'organisation : elle propose, elle n'écrit jamais. Une règle sans condition est refusée.
 */
final readonly class CreateBankRule
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(BankRuleData $donnees, string $userId): BankRule
    {
        return DB::transaction(function () use ($donnees, $userId): BankRule {
            $empreinte = null;

            if ($donnees->counterpartyLineId !== null) {
                $empreinte = (BankStatementLine::query()->find($donnees->counterpartyLineId) ?? throw ErrorCode::LineNotFound->problem())->counterparty_hash;
            }

            if ($donnees->labelContains === null && $empreinte === null && $donnees->transactionCode === null && $donnees->amountMin === null && $donnees->amountMax === null && $donnees->direction === null) {
                throw ErrorCode::RuleNotFound->problem('Une règle porte au moins une condition.');
            }

            $regle = BankRule::query()->create([
                'name' => $donnees->name, 'label_contains' => $donnees->labelContains, 'counterparty_hash' => $empreinte, 'transaction_code' => $donnees->transactionCode,
                'amount_min' => $donnees->amountMin, 'amount_max' => $donnees->amountMax, 'direction' => $donnees->direction, 'action' => $donnees->action,
                'target_lease_id' => $donnees->action === RuleAction::SuggestLease ? $donnees->targetLeaseId : null,
                'ignore_reason' => $donnees->action === RuleAction::SuggestIgnore ? $donnees->ignoreReason : null,
                'confidence' => $donnees->confidence, 'position' => $donnees->position ?? ((int) BankRule::query()->max('position')) + 1,
                'active' => $donnees->active, 'lock_version' => 1, 'created_by_user_id' => $userId,
            ]);

            $this->audit->handle('banking.rule.created', subject: $regle, metadata: ['action' => $regle->action->value]);

            return $regle;
        });
    }
}
