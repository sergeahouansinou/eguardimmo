<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Banking\Data\SuggestionData;
use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Suggestions\RuleEngine;
use App\Modules\Banking\Support\Suggestions\SuggestionContext;
use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Rent\PublicApi\RentLedger;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Calcule les propositions des lignes non pointées (un relevé ou toute l'organisation). Idempotent : les propositions d'une ligne
 * sont remplacées. Une proposition est un cache recalculable ; aucune n'écrit au grand livre.
 */
final readonly class ComputeSuggestions
{
    private const CHUNK = 500;

    public function __construct(
        private RentLedger $loyers,
        private InvoiceLedger $factures,
        private BankBook $banque,
        private PartyDirectory $parties,
        private LedgerAggregates $agregats,
        private RuleEngine $regles,
        private CurrentOrganization $organisation,
    ) {}

    public function handle(?string $statementId = null): int
    {
        $total = 0;

        foreach (OrganizationBankAccount::query()->where('status', AccountStatus::Active)->orderBy('id')->get() as $compte) {
            $requete = BankStatementLine::query()->where('bank_account_id', $compte->id)->where('state', LineState::Unmatched)
                ->whereIn('statement_id', DB::table('bank_statements')->whereNull('voided_at')->when($statementId !== null, fn ($q) => $q->where('id', $statementId))->select('id'))
                ->orderBy('id');

            $requete->chunkById(self::CHUNK, function ($lignes) use ($compte, &$total): void {
                $lignes = array_values($lignes->all());
                $resultats = $this->evaluate($compte, $lignes);
                $version = $this->agregats->version();
                $maintenant = now();
                $lot = [];

                foreach ($lignes as $ligne) {
                    $proposition = $resultats[$ligne->id] ?? null;

                    if ($proposition === null) {
                        continue;
                    }

                    $lot[] = [
                        'id' => (string) Str::uuid7(), 'organization_id' => $this->organisation->id(), 'statement_line_id' => $ligne->id,
                        'rule' => $proposition->rule->value, 'confidence' => $proposition->confidence->value, 'score' => $proposition->score,
                        'action' => $proposition->action->value, 'targets' => json_encode($proposition->targets), 'explanation' => json_encode(['codes' => $proposition->codes, 'ids' => $proposition->ids]),
                        'ledger_version' => $version, 'computed_at' => $maintenant, 'created_at' => $maintenant, 'updated_at' => $maintenant,
                    ];
                }

                DB::transaction(function () use ($lignes, $lot): void {
                    DB::table('bank_suggestions')->whereIn('statement_line_id', array_map(static fn (BankStatementLine $l): string => $l->id, $lignes))->delete();

                    if ($lot !== []) {
                        DB::table('bank_suggestions')->insert($lot);
                    }
                });

                $total += count($lot);
            });
        }

        return $total;
    }

    /**
     * @param  list<BankStatementLine>  $lignes
     * @return array<string, SuggestionData|null> par identifiant de ligne
     */
    public function evaluate(OrganizationBankAccount $compte, array $lignes): array
    {
        if ($lignes === []) {
            return [];
        }

        $dates = array_map(static fn (BankStatementLine $l): string => $l->booking_date->toDateString(), $lignes);
        $contexte = (new SuggestionContext($this->loyers, $this->factures, $this->banque, $this->parties))
            ->load($compte, CarbonImmutable::parse(min($dates)), CarbonImmutable::parse(max($dates)));
        $resultats = [];

        foreach ($lignes as $ligne) {
            $resultats[$ligne->id] = $this->regles->evaluate($ligne, $contexte);
        }

        return $resultats;
    }
}
