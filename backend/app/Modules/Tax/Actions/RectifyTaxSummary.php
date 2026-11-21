<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Investments\PublicApi\LoanCosts;
use App\Modules\Tax\Data\NewSummaryData;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Support\ActiveKeys;
use App\Modules\Tax\Support\SummaryWriter;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class RectifyTaxSummary
{
    public function __construct(
        private ComputeRentalIncome $calcul,
        private SummaryWriter $ecriture,
        private LoanCosts $prets,
        private RecordAudit $audit,
    ) {}

    /**
     * Rectificatif d'une synthèse de bailleur autonome : recalcul sur le grand livre d'aujourd'hui, motif obligatoire, l'original passe à
     * `superseded` dans la même transaction et n'est jamais réécrit. Le numéro de version lu par le client protège d'un rectificatif
     * concurrent.
     *
     * @return array{summary: TaxSummary, replayed: bool}
     */
    public function handle(TaxSummary $original, string $motif, int $versionLue, string $cle, ?string $userId): array
    {
        $empreinte = hash('sha256', (string) json_encode(['rectify', $original->id, $motif, $versionLue], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($original, $motif, $versionLue, $cle, $empreinte, $userId): array {
                $rejeu = TaxSummary::query()->where('idempotency_key', $cle)->first();

                if ($rejeu !== null) {
                    return hash_equals($rejeu->request_hash, $empreinte) ? ['summary' => $rejeu, 'replayed' => true] : throw ErrorCode::IdempotencyKeyReused->problem();
                }

                $source = TaxSummary::query()->whereKey($original->id)->lockForUpdate()->firstOrFail();

                if ($source->scope !== SummaryScope::Organization) {
                    throw ErrorCode::SummaryNotFound->problem();
                }

                if ($source->status === SummaryStatus::Superseded) {
                    throw ErrorCode::SummaryNotRectifiable->problem('Cette synthèse a déjà été remplacée par un rectificatif.');
                }

                if ($source->lock_version !== $versionLue) {
                    throw ErrorCode::SummaryStaleVersion->problem();
                }

                $calcul = $this->calcul->handle($source->income_year, $source->snapshot['household_complete'] === true);

                if ($calcul->income->blockers !== []) {
                    throw ErrorCode::InterestSourceConflict->problem('Un bien a un prêt suivi et une dépense « intérêts d\'emprunt » pour cette année : gardez une seule source.');
                }

                $source->forceFill(['status' => SummaryStatus::Superseded, 'active_key' => null, 'lock_version' => $source->lock_version + 1])->save();
                $nouvelle = $this->ecriture->write(new NewSummaryData(
                    SummaryScope::Organization, null, $calcul->income, $calcul->ledgerCutoff, $cle, $empreinte, ActiveKeys::organization($source->income_year), $source->id, $motif, $userId, null,
                ));
                $this->prets->markUsed($calcul->loanIds, $source->income_year);
                $this->audit->handle('tax.summary.rectified', subject: $nouvelle, metadata: ['income_year' => $source->income_year, 'supersedes_id' => $source->id, 'fingerprint' => $nouvelle->fingerprint]);

                return ['summary' => $nouvelle, 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::SummaryStaleVersion->problem();
        }
    }
}
