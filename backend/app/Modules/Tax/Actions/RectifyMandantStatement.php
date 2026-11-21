<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

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

final readonly class RectifyMandantStatement
{
    public function __construct(
        private ComputeMandantStatement $calcul,
        private SummaryWriter $ecriture,
        private RecordAudit $audit,
    ) {}

    /**
     * Rectificatif d'un relevé de mandant, recalculé sur le grand livre d'aujourd'hui. Un original déjà publié reste lisible par le mandant
     * jusqu'à la publication du rectificatif (clé vivante propre) ; un original non publié est remplacé aussitôt. Un rectificatif non publié se
     * refait en reprenant la clé d'attente et l'original qu'il remplaçait. Motif obligatoire,
     * numéro de version lu par le client contre un rectificatif concurrent.
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

                if ($source->scope !== SummaryScope::Mandant) {
                    throw ErrorCode::SummaryNotFound->problem();
                }

                if ($source->status === SummaryStatus::Superseded) {
                    throw ErrorCode::SummaryNotRectifiable->problem('Ce relevé a déjà été remplacé.');
                }

                if ($source->lock_version !== $versionLue) {
                    throw ErrorCode::SummaryStaleVersion->problem();
                }

                $mandantId = (string) $source->mandant_party_id;
                $calcul = $this->calcul->handle($mandantId, $source->income_year);
                $publie = $source->status === SummaryStatus::Published;
                $enAttente = ! $publie && $source->supersedes_id !== null;
                $remplace = $enAttente ? (string) $source->supersedes_id : $source->id;

                if (! $publie) {
                    $source->forceFill(['status' => SummaryStatus::Superseded, 'active_key' => null, 'lock_version' => $source->lock_version + 1])->save();
                }

                $nouvelle = $this->ecriture->write(new NewSummaryData(
                    SummaryScope::Mandant, $mandantId, $calcul->income, $calcul->ledgerCutoff, $cle, $empreinte,
                    $publie || $enAttente ? ActiveKeys::pendingRectification($remplace) : ActiveKeys::mandant($mandantId, $source->income_year),
                    $remplace, $motif, $userId, $calcul->holderName,
                ));
                $this->audit->handle('tax.summary.rectified', subject: $nouvelle, metadata: ['income_year' => $source->income_year, 'scope' => 'mandant', 'supersedes_id' => $remplace, 'fingerprint' => $nouvelle->fingerprint]);

                return ['summary' => $nouvelle, 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::SummaryExists->problem('Un rectificatif est déjà en attente de publication pour ce relevé.');
        }
    }
}
