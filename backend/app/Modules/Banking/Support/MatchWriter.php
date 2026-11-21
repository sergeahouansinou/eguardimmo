<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\MatchKind;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Enums\SuggestionRule;
use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankStatementLine;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Écrit un pointage : équilibre des montants, un seul pointage vivant par ligne (contrainte), état des lignes de relevé.
 * À appeler dans une transaction qui détient déjà le verrou des lignes de relevé. N'écrit rien au grand livre.
 */
final readonly class MatchWriter
{
    public function __construct(private RecordAudit $audit, private CurrentOrganization $organisation) {}

    /**
     * @param  list<BankStatementLine>  $lignes
     * @param  list<BankBookLineData>  $ecritures
     * @param  array<string, mixed>|null  $explication
     */
    public function write(
        string $accountId,
        MatchKind $genre,
        array $lignes,
        array $ecritures,
        string $userId,
        ?SuggestionRule $regle = null,
        ?Confidence $confiance = null,
        ?array $explication = null,
    ): BankMatch {
        if ($lignes === [] || $ecritures === []) {
            throw ErrorCode::MatchUnbalanced->problem();
        }

        $releve = 0;

        foreach ($lignes as $ligne) {
            if ($ligne->state !== LineState::Unmatched) {
                throw ErrorCode::LineNotMatchable->problem();
            }

            $releve += $ligne->direction->sign() * (int) $ligne->amount->getAmount();
        }

        $livre = 0;

        foreach ($ecritures as $ecriture) {
            $livre += ($ecriture->side->value === 'debit' ? 1 : -1) * (int) $ecriture->amount->getAmount();
        }

        if ($releve !== $livre) {
            throw ErrorCode::MatchUnbalanced->problem();
        }

        $pointage = BankMatch::query()->create([
            'bank_account_id' => $accountId, 'kind' => $genre, 'rule' => $regle, 'confidence' => $confiance, 'explanation' => $explication, 'matched_by_user_id' => $userId,
        ]);

        $maintenant = now();
        $elements = [];

        foreach ($lignes as $ligne) {
            $elements[] = $this->item($pointage->id, MatchSide::StatementLine, $ligne->id, (int) $ligne->amount->getAmount(), $ligne->currency, $maintenant);
        }

        foreach ($ecritures as $ecriture) {
            $elements[] = $this->item($pointage->id, MatchSide::JournalLine, $ecriture->lineId, (int) $ecriture->amount->getAmount(), $ecriture->amount->getCurrency()->getCode(), $maintenant);
        }

        try {
            DB::table('bank_match_items')->insert($elements);
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::LineNotMatchable->problem();
        }

        DB::table('bank_statement_lines')->whereIn('id', array_map(static fn (BankStatementLine $l): string => $l->id, $lignes))
            ->update(['state' => LineState::Matched->value, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => $maintenant]);

        $this->audit->handle('banking.match.created', subject: $pointage, metadata: [
            'kind' => $genre->value, 'rule' => $regle?->value, 'confidence' => $confiance?->value, 'statement_lines' => count($lignes), 'journal_lines' => count($ecritures),
        ]);

        return $pointage;
    }

    /**
     * @return array<string, mixed>
     */
    private function item(string $matchId, MatchSide $cote, string $refId, int $montant, string $devise, mixed $maintenant): array
    {
        return [
            'id' => (string) Str::uuid7(), 'organization_id' => $this->organisation->id(), 'match_id' => $matchId, 'side' => $cote->value, 'ref_id' => $refId,
            'amount' => $montant, 'currency' => $devise, 'undone_at' => null, 'created_at' => $maintenant, 'updated_at' => $maintenant,
        ];
    }
}
