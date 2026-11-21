<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Tax\Data\NewSummaryData;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Support\ActiveKeys;
use App\Modules\Tax\Support\Facts\LeaseUniverse;
use App\Modules\Tax\Support\SummaryWriter;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class GenerateMandantStatements
{
    public function __construct(
        private ComputeMandantStatement $calcul,
        private SummaryWriter $ecriture,
        private RecordAudit $audit,
    ) {}

    /**
     * Un relevé par mandant, chacun dans sa transaction : l'échec d'un mandant n'empêche pas les autres. Rejouable par mandant (clé
     * d'idempotence dérivée de l'en-tête et du mandant). Une année non terminée refuse toute la demande (409). Le temps est borné (`tax.statements_time_budget_seconds`) : au-delà, les mandants restants reviennent en échec 503 `tax_batch_time_exceeded` et se relancent avec la même clé.
     *
     * @param  list<string>  $mandantIds
     * @return list<array{mandant_id: string, outcome: 'created'|'replayed'|'failed', summary: TaxSummary|null, error: ApiProblem|null}>
     */
    public function handle(int $annee, array $mandantIds, string $cle, ?string $userId): array
    {
        $this->calcul->assertYearOver($annee);
        $univers = null;
        $resultats = [];
        $debut = CarbonImmutable::now();
        $budget = (int) config('tax.statements_time_budget_seconds');

        foreach (array_values(array_unique($mandantIds)) as $rang => $mandantId) {
            if ($rang > 0 && $debut->diffInSeconds(CarbonImmutable::now(), true) >= $budget) {
                $resultats[] = ['mandant_id' => $mandantId, 'outcome' => 'failed', 'summary' => null, 'error' => ErrorCode::BatchTimeExceeded->problem()];

                continue;
            }

            try {
                $univers ??= $this->calcul->universe($annee);
                [$synthese, $rejoue] = $this->pour($mandantId, $annee, $cle, $userId, $univers);
                $resultats[] = ['mandant_id' => $mandantId, 'outcome' => $rejoue ? 'replayed' : 'created', 'summary' => $synthese, 'error' => null];
            } catch (ApiProblem $erreur) {
                $resultats[] = ['mandant_id' => $mandantId, 'outcome' => 'failed', 'summary' => null, 'error' => $erreur];
            }
        }

        return $resultats;
    }

    /**
     * @return array{TaxSummary, bool}
     */
    private function pour(string $mandantId, int $annee, string $cle, ?string $userId, LeaseUniverse $univers): array
    {
        $empreinte = hash('sha256', (string) json_encode(['mandant', $mandantId, $annee], JSON_THROW_ON_ERROR));
        $cleMandant = hash('sha256', $cle.'|'.$mandantId);

        try {
            return DB::transaction(function () use ($mandantId, $annee, $cleMandant, $empreinte, $userId, $univers): array {
                $existante = TaxSummary::query()->where('idempotency_key', $cleMandant)->first();

                if ($existante !== null) {
                    return [$this->rejouer($existante, $empreinte), true];
                }

                $calcul = $this->calcul->handle($mandantId, $annee, $univers);

                if (TaxSummary::query()->where('active_key', ActiveKeys::mandant($mandantId, $annee))->exists()) {
                    throw ErrorCode::SummaryExists->problem('Un relevé existe déjà pour ce mandant et cette année : rectifiez-le.');
                }

                $synthese = $this->ecriture->write(new NewSummaryData(
                    SummaryScope::Mandant, $mandantId, $calcul->income, $calcul->ledgerCutoff, $cleMandant, $empreinte, ActiveKeys::mandant($mandantId, $annee), null, null, $userId, $calcul->holderName,
                ));
                $this->audit->handle('tax.summary.finalized', subject: $synthese, metadata: ['income_year' => $annee, 'scope' => 'mandant', 'form_version' => $synthese->form_version, 'fingerprint' => $synthese->fingerprint]);

                return [$synthese, false];
            });
        } catch (UniqueConstraintViolationException) {
            $existante = TaxSummary::query()->where('idempotency_key', $cleMandant)->first();

            return $existante !== null ? [$this->rejouer($existante, $empreinte), true] : throw ErrorCode::SummaryExists->problem();
        }
    }

    private function rejouer(TaxSummary $existante, string $empreinte): TaxSummary
    {
        return hash_equals($existante->request_hash, $empreinte) ? $existante : throw ErrorCode::IdempotencyKeyReused->problem();
    }
}
