<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\MatchKind;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Models\BankSuggestion;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\CounterpartyLearner;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Banking\Support\LineLocker;
use App\Modules\Banking\Support\LineSettler;
use App\Modules\Banking\Support\MatchWriter;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currency;

/**
 * Validation groupée (50 propositions `exact` ou `strong` au plus) : chacune est recalculée sous le verrou de sa ligne ; une
 * proposition périmée est écartée avec son motif, les autres passent. Rejouer la même clé ne refait rien.
 */
final readonly class AcceptSuggestions
{
    public function __construct(
        private ComputeSuggestions $calcul,
        private LineLocker $verrou,
        private LineSettler $reglement,
        private MatchWriter $ecriture,
        private BankBook $banque,
        private CounterpartyLearner $apprentissage,
        private IgnoreLine $ignorer,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * @param  list<string>  $suggestionIds
     * @return array{accepted: list<array{suggestion_id: string, match_id: string|null}>, skipped: list<array{suggestion_id: string, reason: string}>, replayed: bool}
     */
    public function handle(array $suggestionIds, string $userId, string $cle): array
    {
        $ids = array_values(array_unique($suggestionIds));
        sort($ids);

        if ($ids === [] || count($ids) > (int) config('banking.accept_max')) {
            throw ErrorCode::LineNotMatchable->problem('Entre 1 et '.config('banking.accept_max').' propositions par validation.');
        }

        $empreinte = hash('sha256', (string) json_encode(['accept', $ids]));
        $accepte = [];
        $ecarte = [];

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($ids, $userId, &$accepte, &$ecarte): array {
            foreach ($ids as $id) {
                $this->one($id, $userId, $accepte, $ecarte);
            }

            $this->audit->handle('banking.suggestions.accepted', metadata: ['accepted' => count($accepte), 'skipped' => count($ecarte)]);

            return ['type' => 'bank_accept', 'id' => (string) Str::uuid7()];
        });

        return ['accepted' => $accepte, 'skipped' => $ecarte, 'replayed' => $resultat['replayed']];
    }

    /**
     * @param  list<array{suggestion_id: string, match_id: string|null}>  $accepte
     * @param  list<array{suggestion_id: string, reason: string}>  $ecarte
     */
    private function one(string $id, string $userId, array &$accepte, array &$ecarte): void
    {
        $proposition = BankSuggestion::query()->find($id);

        if ($proposition === null) {
            $ecarte[] = ['suggestion_id' => $id, 'reason' => 'suggestion_not_found'];

            return;
        }

        if ($proposition->confidence === Confidence::Weak) {
            $ecarte[] = ['suggestion_id' => $id, 'reason' => 'not_acceptable'];

            return;
        }

        try {
            $pointageId = DB::transaction(function () use ($proposition, $userId): ?string {
                $ligne = $this->verrou->lock($this->accountOf($proposition->statement_line_id), [$proposition->statement_line_id])[$proposition->statement_line_id];

                if ($ligne->state !== LineState::Unmatched) {
                    throw ErrorCode::LineNotMatchable->problem();
                }

                $compte = OrganizationBankAccount::query()->findOrFail($ligne->bank_account_id);
                $courante = $this->calcul->evaluate($compte, [$ligne])[$ligne->id] ?? null;

                if ($courante === null || $courante->action !== $proposition->action || $this->empreinte($courante->targets) !== $this->empreinte($proposition->targets) || $courante->rule !== $proposition->rule) {
                    throw ErrorCode::LineStale->problem();
                }

                if ($courante->confidence === Confidence::Weak) {
                    throw ErrorCode::LineStale->problem();
                }

                $explication = ['codes' => $courante->codes, 'ids' => $courante->ids];
                $cibles = $courante->targets;

                if ($courante->action === SuggestionAction::Ignore) {
                    $this->ignorer->handle($ligne->id, IgnoreReason::tryFrom((string) ($courante->ids['ignore_reason'] ?? '')) ?? IgnoreReason::Other, null, null);

                    return null;
                }

                if ($courante->action === SuggestionAction::Match) {
                    $ecritures = $this->banque->find($compte->ledger_role->accountRole(), new Currency($compte->currency), array_column($cibles, 'id'));

                    if (count($ecritures) !== count($cibles)) {
                        throw ErrorCode::LineStale->problem();
                    }

                    return $this->ecriture->write($compte->id, MatchKind::Suggested, [$ligne], array_values($ecritures), $userId, $courante->rule, $courante->confidence, $explication)->id;
                }

                $this->apprentissage->learn($ligne, $courante->action, $cibles);

                return $this->reglement->settle($ligne, $compte, $courante->action, $cibles, $userId, $courante->rule, $explication)->id;
            });

            $accepte[] = ['suggestion_id' => $id, 'match_id' => $pointageId];
        } catch (ApiProblem $erreur) {
            $ecarte[] = ['suggestion_id' => $id, 'reason' => $erreur->problemCode];
        }
    }

    private function accountOf(string $lineId): string
    {
        return (string) DB::table('bank_statement_lines')->where('id', $lineId)->value('bank_account_id');
    }

    /**
     * MySQL réordonne les clés d'un JSON : on compare les cibles sur leur contenu, pas sur l'ordre des clés.
     *
     * @param  list<array{type: string, id: string, amount: int}>  $cibles
     * @return list<string>
     */
    private function empreinte(array $cibles): array
    {
        return array_map(static fn (array $c): string => $c['type'].':'.$c['id'].':'.$c['amount'], $cibles);
    }
}
