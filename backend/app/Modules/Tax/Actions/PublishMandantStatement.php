<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Modules\Tax\Events\TaxStatementPublished;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Support\ActiveKeys;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class PublishMandantStatement
{
    public function __construct(
        private ComputeMandantStatement $calcul,
        private LedgerAggregates $grandLivre,
        private RecordAudit $audit,
    ) {}

    /**
     * Rend le relevé lisible au mandant. L'année doit être close au grand livre (décembre inclus) et le calcul d'aujourd'hui doit redonner
     * l'empreinte du relevé : sinon un rectificatif s'impose (409). Rejouable : un relevé déjà publié est renvoyé tel quel. Un rectificatif
     * publié remplace l'original dans la même transaction.
     *
     * @return array{summary: TaxSummary, replayed: bool}
     */
    public function handle(TaxSummary $synthese, int $versionLue, ?string $userId): array
    {
        return DB::transaction(function () use ($synthese, $versionLue, $userId): array {
            $source = TaxSummary::query()->whereKey($synthese->id)->lockForUpdate()->firstOrFail();

            if ($source->scope !== SummaryScope::Mandant) {
                throw ErrorCode::SummaryNotFound->problem();
            }

            if ($source->status === SummaryStatus::Published) {
                return ['summary' => $source, 'replayed' => true];
            }

            if ($source->status === SummaryStatus::Superseded) {
                throw ErrorCode::NotPublishable->problem('Ce relevé a été remplacé.');
            }

            if ($source->lock_version !== $versionLue) {
                throw ErrorCode::SummaryStaleVersion->problem();
            }

            if (! $this->grandLivre->isClosed(CarbonImmutable::createFromDate($source->income_year, 12, 1)->startOfDay())) {
                throw ErrorCode::PeriodNotClosed->problem('L\'année n\'est pas close au grand livre : clôturez décembre avant de publier.');
            }

            $mandantId = (string) $source->mandant_party_id;
            $recalcul = $this->calcul->handle($mandantId, $source->income_year);

            if (! hash_equals($source->fingerprint, $recalcul->income->fingerprint())) {
                throw ErrorCode::SummaryStaleVersion->problem('Le grand livre a changé depuis le calcul de ce relevé : rectifiez-le avant de le publier.');
            }

            $remplacee = $source->supersedes_id === null ? null : TaxSummary::query()->whereKey($source->supersedes_id)->lockForUpdate()->first();

            if ($remplacee !== null && $remplacee->status === SummaryStatus::Published) {
                $remplacee->forceFill(['status' => SummaryStatus::Superseded, 'active_key' => null, 'lock_version' => $remplacee->lock_version + 1])->save();
            }

            $source->forceFill([
                'status' => SummaryStatus::Published,
                'active_key' => ActiveKeys::mandant($mandantId, $source->income_year),
                'published_at' => CarbonImmutable::now(),
                'published_by_user_id' => $userId,
                'lock_version' => $source->lock_version + 1,
            ])->save();

            $this->audit->handle('tax.summary.published', subject: $source, metadata: ['income_year' => $source->income_year, 'scope' => 'mandant', 'rectification' => $source->supersedes_id !== null]);
            TaxStatementPublished::dispatch($source->id, $source->organization_id, $mandantId, $source->income_year);

            return ['summary' => $source, 'replayed' => false];
        });
    }
}
