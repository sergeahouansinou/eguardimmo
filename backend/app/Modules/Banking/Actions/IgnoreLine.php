<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\LedgerRole;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\LineLocker;
use App\Modules\Banking\Support\ValidatedStateGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Sur `Bank`, une ligne se laisse de côté seule ; sur `TrustBank`, seulement par paire de montant net nul (opération erronée et
 * son annulation) : tout mouvement du compte de tiers doit être au grand livre.
 */
final readonly class IgnoreLine
{
    public function __construct(private LineLocker $verrou, private ValidatedStateGuard $etats, private RecordAudit $audit) {}

    public function handle(string $lineId, IgnoreReason $motif, ?int $lockVersion, ?string $pairLineId): BankStatementLine
    {
        return DB::transaction(function () use ($lineId, $motif, $lockVersion, $pairLineId): BankStatementLine {
            $compte = OrganizationBankAccount::query()->findOrFail((BankStatementLine::query()->find($lineId) ?? throw ErrorCode::LineNotFound->problem())->bank_account_id);
            $ids = $pairLineId === null ? [$lineId] : [$lineId, $pairLineId];
            $lignes = $this->verrou->lock($compte->id, $ids);

            $ligne = $lignes[$lineId];

            if ($lockVersion !== null && $ligne->lock_version !== $lockVersion) {
                throw ErrorCode::LineStale->problem();
            }

            foreach ($lignes as $courante) {
                if ($courante->state !== LineState::Unmatched) {
                    throw ErrorCode::LineNotMatchable->problem();
                }
            }

            if ($compte->ledger_role === LedgerRole::TrustBank) {
                $paire = $lignes[$pairLineId] ?? null;

                if ($pairLineId === null || $paire === null || $paire->id === $ligne->id || $paire->direction === $ligne->direction || ! $paire->amount->equals($ligne->amount)) {
                    throw ErrorCode::IgnoreForbidden->problem();
                }
            } elseif ($pairLineId !== null) {
                throw ErrorCode::IgnoreForbidden->problem();
            }

            $this->etats->assertNotCovered($compte->id, $lignes);

            DB::table('bank_statement_lines')->whereIn('id', $ids)->update([
                'state' => LineState::Ignored->value, 'ignore_reason' => $motif->value, 'ignore_group_id' => $pairLineId === null ? null : Str::uuid()->toString(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now(),
            ]);

            $this->audit->handle('banking.line.ignored', subject: $ligne, metadata: ['reason' => $motif->value, 'paired' => $pairLineId !== null]);

            return BankStatementLine::query()->findOrFail($lineId);
        });
    }
}
