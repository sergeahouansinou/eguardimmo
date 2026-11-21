<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\LedgerRole;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Models\BankMatchItem;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Queries\OrganizationsWithAccounts;
use App\Modules\Banking\Support\StatementGaps;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Money\Currency;

/**
 * Contrôle quotidien : il signale, ne corrige rien. Ni libellé ni IBAN dans le journal, seulement des identifiants.
 */
final readonly class VerifyBanking
{
    public const string ENTRY_REVERSED = 'matched_entry_reversed';

    public const string GAP = 'statement_gap';

    public const string TRUST_IGNORE_UNPAIRED = 'trust_ignored_line_unpaired';

    private const int AUDIT_REMINDER_DAYS = 7;

    public function __construct(
        private CurrentOrganization $contexte,
        private OrganizationsWithAccounts $organisations,
        private BankBook $banque,
        private StatementGaps $trous,
        private RecordAudit $audit,
    ) {}

    /**
     * @return list<array{organization: string, account: string, kind: string}>
     */
    public function handle(): array
    {
        $anomalies = [];

        foreach ($this->organisations->ids() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, &$anomalies): void {
                foreach (OrganizationBankAccount::query()->where('status', AccountStatus::Active)->orderBy('id')->get() as $compte) {
                    foreach ($this->constats($compte) as $genre) {
                        $anomalies[] = ['organization' => $organisation, 'account' => $compte->id, 'kind' => $genre];
                        Log::critical('Anomalie bancaire', ['organization_id' => $organisation, 'account_id' => $compte->id, 'kind' => $genre]);
                        $this->auditer($compte, $genre);
                    }
                }
            });
        }

        return $anomalies;
    }

    /**
     * Le journal d'audit garde la première détection puis un rappel hebdomadaire ; l'alerte (`Log::critical`) et le code de sortie
     * restent quotidiens.
     */
    private function auditer(OrganizationBankAccount $compte, string $genre): void
    {
        $recent = DB::table('audit_logs')->where('action', 'banking.verify.anomaly')->where('subject_type', 'organization_bank_account')->where('subject_id', $compte->id)
            ->where('metadata->kind', $genre)->where('occurred_at', '>=', now()->subDays(self::AUDIT_REMINDER_DAYS))->exists();

        if (! $recent) {
            $this->audit->handle('banking.verify.anomaly', subject: $compte, metadata: ['kind' => $genre]);
        }
    }

    /**
     * @return list<string>
     */
    private function constats(OrganizationBankAccount $compte): array
    {
        $genres = [];

        if ($this->ecrituresContrepassees($compte)) {
            $genres[] = self::ENTRY_REVERSED;
        }

        if ($this->trous->of($compte->id) !== []) {
            $genres[] = self::GAP;
        }

        if ($compte->ledger_role === LedgerRole::TrustBank && $this->ignoreesSansPaire($compte)) {
            $genres[] = self::TRUST_IGNORE_UNPAIRED;
        }

        return $genres;
    }

    private function ecrituresContrepassees(OrganizationBankAccount $compte): bool
    {
        $ids = BankMatchItem::query()->where('side', MatchSide::JournalLine)->whereNull('undone_at')
            ->whereIn('match_id', DB::table('bank_matches')->where('bank_account_id', $compte->id)->whereNull('undone_at')->select('id'))
            ->pluck('ref_id')->all();

        foreach (array_chunk(array_values($ids), 500) as $lot) {
            foreach ($this->banque->find($compte->ledger_role->accountRole(), new Currency($compte->currency), $lot) as $ligne) {
                if ($ligne->isReversed) {
                    return true;
                }
            }
        }

        return false;
    }

    private function ignoreesSansPaire(OrganizationBankAccount $compte): bool
    {
        $groupes = [];

        foreach (BankStatementLine::query()->where('bank_account_id', $compte->id)->where('state', LineState::Ignored)->get(['id', 'amount', 'currency', 'direction', 'ignore_group_id']) as $ligne) {
            if ($ligne->ignore_group_id === null) {
                return true;
            }

            $groupes[$ligne->ignore_group_id][] = $ligne;
        }

        foreach ($groupes as $membres) {
            if (count($membres) !== 2 || $membres[0]->direction === $membres[1]->direction || ! $membres[0]->amount->equals($membres[1]->amount)) {
                return true;
            }
        }

        return false;
    }
}
