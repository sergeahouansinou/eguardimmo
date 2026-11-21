<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\MatchKind;
use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Banking\Support\LineLocker;
use App\Modules\Banking\Support\MatchWriter;
use Money\Currency;

/**
 * Pointage manuel de N lignes de relevé sur M lignes d'écriture du même rôle de compte (N:M).
 */
final readonly class MatchLines
{
    public function __construct(
        private LineLocker $verrou,
        private MatchWriter $ecriture,
        private BankBook $livre,
        private Idempotency $idempotence,
    ) {}

    /**
     * @param  list<string>  $otherLineIds  lignes de relevé jointes à celle de la route
     * @param  list<string>  $journalLineIds
     * @return array{match: BankMatch, replayed: bool}
     */
    public function handle(string $lineId, array $otherLineIds, array $journalLineIds, ?int $lockVersion, string $userId, string $cle): array
    {
        $accountId = (BankStatementLine::query()->find($lineId) ?? throw ErrorCode::LineNotFound->problem())->bank_account_id;
        $lineIds = array_values(array_unique([$lineId, ...$otherLineIds]));
        sort($lineIds);
        $journal = array_values(array_unique($journalLineIds));
        sort($journal);
        $empreinte = hash('sha256', (string) json_encode(['match', $accountId, $lineIds, $journal, $lockVersion]));

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($accountId, $lineId, $lineIds, $journal, $lockVersion, $userId): array {
            $lignes = $this->verrou->lock($accountId, $lineIds);

            foreach ($lignes as $ligne) {
                if ($lockVersion !== null && $ligne->id === $lineId && $ligne->lock_version !== $lockVersion) {
                    throw ErrorCode::LineStale->problem();
                }
            }

            $compte = OrganizationBankAccount::query()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

            if ($compte->status !== AccountStatus::Active) {
                throw ErrorCode::AccountClosed->problem();
            }

            $ecritures = $this->livre->find($compte->ledger_role->accountRole(), new Currency($compte->currency), $journal);

            if (count($ecritures) !== count($journal)) {
                throw ErrorCode::LineNotFound->problem();
            }

            $pointage = $this->ecriture->write($accountId, MatchKind::Manual, array_values($lignes), array_values($ecritures), $userId);

            return ['type' => 'bank_match', 'id' => $pointage->id];
        });

        return ['match' => BankMatch::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
