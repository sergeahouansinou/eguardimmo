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

final readonly class UpdateBankRule
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(string $ruleId, BankRuleData $donnees, int $lockVersion): BankRule
    {
        return DB::transaction(function () use ($ruleId, $donnees, $lockVersion): BankRule {
            $regle = BankRule::query()->lockForUpdate()->find($ruleId) ?? throw ErrorCode::RuleNotFound->problem();

            if ($regle->lock_version !== $lockVersion) {
                throw ErrorCode::LineStale->problem('La règle a été modifiée entre-temps.');
            }

            $empreinte = $regle->counterparty_hash;

            if ($donnees->counterpartyLineId !== null) {
                $empreinte = (BankStatementLine::query()->find($donnees->counterpartyLineId) ?? throw ErrorCode::LineNotFound->problem())->counterparty_hash;
            }

            $etaitActive = $regle->active;
            $regle->forceFill([
                'name' => $donnees->name, 'label_contains' => $donnees->labelContains, 'counterparty_hash' => $empreinte, 'transaction_code' => $donnees->transactionCode,
                'amount_min' => $donnees->amountMin, 'amount_max' => $donnees->amountMax, 'direction' => $donnees->direction, 'action' => $donnees->action,
                'target_lease_id' => $donnees->action === RuleAction::SuggestLease ? $donnees->targetLeaseId : null,
                'ignore_reason' => $donnees->action === RuleAction::SuggestIgnore ? $donnees->ignoreReason : null,
                'confidence' => $donnees->confidence, 'position' => $donnees->position ?? $regle->position, 'active' => $donnees->active, 'lock_version' => $regle->lock_version + 1,
            ])->save();

            $this->audit->handle($etaitActive && ! $regle->active ? 'banking.rule.disabled' : 'banking.rule.updated', subject: $regle, metadata: ['action' => $regle->action->value]);

            return $regle;
        });
    }
}
