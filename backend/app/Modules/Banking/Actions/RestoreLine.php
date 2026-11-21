<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LedgerRole;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\LineLocker;
use App\Modules\Banking\Support\ValidatedStateGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Sur `TrustBank`, une paire laissée de côté se rétablit entière ou pas du tout : rétablir une seule jambe ferait sortir du contrôle
 * un mouvement du compte de tiers.
 */
final readonly class RestoreLine
{
    public function __construct(private LineLocker $verrou, private ValidatedStateGuard $etats, private RecordAudit $audit) {}

    public function handle(string $lineId, ?int $lockVersion): BankStatementLine
    {
        return DB::transaction(function () use ($lineId, $lockVersion): BankStatementLine {
            $apercu = BankStatementLine::query()->find($lineId) ?? throw ErrorCode::LineNotFound->problem();
            $compte = OrganizationBankAccount::query()->findOrFail($apercu->bank_account_id);
            $groupe = $apercu->ignore_group_id;

            $ids = $groupe === null
                ? [$lineId]
                : array_values(array_map(strval(...), BankStatementLine::query()->where('bank_account_id', $compte->id)->where('ignore_group_id', $groupe)->pluck('id')->all()));

            $lignes = $this->verrou->lock($compte->id, $ids);
            $ligne = $lignes[$lineId];

            if ($lockVersion !== null && $ligne->lock_version !== $lockVersion) {
                throw ErrorCode::LineStale->problem();
            }

            foreach ($lignes as $courante) {
                if ($courante->state !== LineState::Ignored || $courante->ignore_group_id !== $groupe) {
                    throw ErrorCode::LineNotMatchable->problem();
                }
            }

            if ($compte->ledger_role === LedgerRole::TrustBank && count($lignes) !== 2) {
                throw ErrorCode::IgnoreForbidden->problem();
            }

            $this->etats->assertNotCovered($compte->id, $lignes);

            DB::table('bank_statement_lines')->whereIn('id', array_keys($lignes))->update([
                'state' => LineState::Unmatched->value, 'ignore_reason' => null, 'ignore_group_id' => null, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now(),
            ]);

            $this->audit->handle('banking.line.restored', subject: $ligne, metadata: ['lines' => count($lignes)]);

            return BankStatementLine::query()->findOrFail($lineId);
        });
    }
}
