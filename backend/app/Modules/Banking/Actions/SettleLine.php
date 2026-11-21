<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\CounterpartyLearner;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Banking\Support\LineLocker;
use App\Modules\Banking\Support\LineSettler;
use App\Shared\Audit\RecordAudit;

/**
 * Création depuis une ligne de relevé : une transaction, verrou de la ligne d'abord, puis l'écriture par le module porteur et le pointage.
 */
final readonly class SettleLine
{
    public function __construct(
        private LineLocker $verrou,
        private LineSettler $reglement,
        private CounterpartyLearner $apprentissage,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * @param  list<array{id: string, amount: int}>  $cibles
     * @return array{match: BankMatch, replayed: bool}
     */
    public function handle(string $lineId, SuggestionAction $action, array $cibles, ?int $lockVersion, string $userId, string $cle): array
    {
        $ligne = BankStatementLine::query()->find($lineId) ?? throw ErrorCode::LineNotFound->problem();
        $accountId = $ligne->bank_account_id;
        $empreinte = hash('sha256', (string) json_encode(['settle', $lineId, $action->value, $cibles, $lockVersion]));

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($accountId, $lineId, $action, $cibles, $lockVersion, $userId): array {
            $verrouillee = $this->verrou->lock($accountId, [$lineId])[$lineId];

            if ($lockVersion !== null && $verrouillee->lock_version !== $lockVersion) {
                throw ErrorCode::LineStale->problem();
            }

            if ($verrouillee->state !== LineState::Unmatched) {
                throw ErrorCode::LineNotMatchable->problem();
            }

            $compte = OrganizationBankAccount::query()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

            if ($compte->status !== AccountStatus::Active) {
                throw ErrorCode::AccountClosed->problem();
            }

            $this->apprentissage->learn($verrouillee, $action, $cibles);
            $pointage = $this->reglement->settle($verrouillee, $compte, $action, $cibles, $userId);
            $this->audit->handle('banking.line.settled', subject: $verrouillee, metadata: ['action' => $action->value, 'match_id' => $pointage->id, 'targets' => count($cibles)]);

            return ['type' => 'bank_match', 'id' => $pointage->id];
        });

        return ['match' => BankMatch::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
