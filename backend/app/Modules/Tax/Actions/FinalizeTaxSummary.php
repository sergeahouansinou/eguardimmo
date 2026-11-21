<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Investments\PublicApi\LoanCosts;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Tax\Data\NewSummaryData;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Support\ActiveKeys;
use App\Modules\Tax\Support\SummaryWriter;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class FinalizeTaxSummary
{
    public function __construct(
        private ComputeRentalIncome $calcul,
        private SummaryWriter $ecriture,
        private LoanCosts $prets,
        private OrganizationDirectory $organisations,
        private RecordAudit $audit,
    ) {}

    /**
     * Fige la synthèse d'une année terminée. Rejouable : la même clé et la même demande renvoient la synthèse déjà figée ; la même
     * clé avec une autre demande est refusée. Une synthèse vivante existe déjà : il faut la rectifier. Une double source sur les
     * intérêts bloque (409), un échec du PDF n'écrit rien (503).
     *
     * @return array{summary: TaxSummary, replayed: bool}
     */
    public function handle(int $annee, bool $foyerComplet, string $cle, ?string $userId): array
    {
        $empreinte = hash('sha256', (string) json_encode(['organization', $annee, $foyerComplet], JSON_THROW_ON_ERROR));
        $rejeu = $this->replay($cle, $empreinte);

        if ($rejeu !== null) {
            return ['summary' => $rejeu, 'replayed' => true];
        }

        $aujourdhui = CarbonImmutable::now($this->organisations->timezone())->startOfDay();

        if ($aujourdhui->lessThan(CarbonImmutable::createFromDate($annee + 1, 1, 1)->startOfDay())) {
            throw ErrorCode::PeriodNotClosed->problem('L\'année de revenus n\'est pas terminée : la synthèse provisoire se consulte, elle ne se fige pas.');
        }

        try {
            return DB::transaction(function () use ($annee, $foyerComplet, $cle, $empreinte, $userId): array {
                if (TaxSummary::query()->where('active_key', ActiveKeys::organization($annee))->exists()) {
                    throw ErrorCode::SummaryExists->problem();
                }

                $calcul = $this->calcul->handle($annee, $foyerComplet);

                if ($calcul->income->blockers !== []) {
                    throw ErrorCode::InterestSourceConflict->problem('Un bien a un prêt suivi et une dépense « intérêts d\'emprunt » pour cette année : gardez une seule source.');
                }

                $synthese = $this->ecriture->write(new NewSummaryData(
                    SummaryScope::Organization, null, $calcul->income, $calcul->ledgerCutoff, $cle, $empreinte, ActiveKeys::organization($annee), null, null, $userId, null,
                ));
                $this->prets->markUsed($calcul->loanIds, $annee);
                $this->audit->handle('tax.summary.finalized', subject: $synthese, metadata: ['income_year' => $annee, 'scope' => 'organization', 'form_version' => $synthese->form_version, 'fingerprint' => $synthese->fingerprint]);

                return ['summary' => $synthese, 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException) {
            $rejeu = $this->replay($cle, $empreinte);

            return $rejeu !== null ? ['summary' => $rejeu, 'replayed' => true] : throw ErrorCode::SummaryExists->problem();
        }
    }

    private function replay(string $cle, string $empreinte): ?TaxSummary
    {
        $existante = TaxSummary::query()->where('idempotency_key', $cle)->first();

        if ($existante === null) {
            return null;
        }

        return hash_equals($existante->request_hash, $empreinte) ? $existante : throw ErrorCode::IdempotencyKeyReused->problem();
    }
}
