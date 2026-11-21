<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

final readonly class CancelPayoutBatch
{
    public function __construct(
        private Ledger $livre,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Brouillon : ses éléments inclus sont écartés. Lot validé : seulement si aucun élément n'est payé ; les validations
     * en attente sont contrepassées. Un virement exécuté ne s'annule pas (retour bancaire).
     *
     * @return array{batch: PayoutBatch, replayed: bool}
     */
    public function handle(string $batchId, string $motif, int $lockVersion, string $cle, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', (string) json_encode(['cancel', $batchId, $motif, $lockVersion], JSON_THROW_ON_ERROR));
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($batchId, $motif, $lockVersion, $today): array {
            $this->lockAccounts($batchId);
            $lot = (Str::isUuid($batchId) ? PayoutBatch::query()->whereKey($batchId)->lockForUpdate()->first() : null) ?? throw ErrorCode::BatchNotFound->problem();

            if ($lot->lock_version !== $lockVersion) {
                throw ErrorCode::StaleVersion->problem();
            }

            if (! in_array($lot->status, [PayoutBatchStatus::Draft, PayoutBatchStatus::Validated], true)) {
                throw ErrorCode::CancelForbidden->problem();
            }

            $items = PayoutItem::query()->where('batch_id', $lot->id)->orderBy('id')->lockForUpdate()->get();

            if ($items->contains(fn (PayoutItem $i): bool => $i->status === PayoutItemStatus::Paid)) {
                throw ErrorCode::CancelForbidden->problem();
            }

            foreach ($items as $element) {
                $this->release($element, $motif, $today);
            }

            $lot->status = PayoutBatchStatus::Cancelled;
            $lot->cancelled_at = now();
            $lot->cancel_reason = $motif;
            $lot->lock_version++;
            $lot->save();
            $this->audit->handle('ownerfunds.batch.cancelled', subject: $lot, metadata: ['items' => $items->count()]);

            return ['type' => 'payout_batch', 'id' => $lot->id];
        });

        return ['batch' => PayoutBatch::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }

    private function release(PayoutItem $element, string $motif, CarbonImmutable $today): void
    {
        if ($element->status === PayoutItemStatus::Pending && $element->transit_entry_id !== null) {
            $this->livre->reverse($element->transit_entry_id, $today);
            $element->status = PayoutItemStatus::Failed;
            $element->failure_reason = $motif;
            $element->save();
        } elseif ($element->status === PayoutItemStatus::Included) {
            $element->status = PayoutItemStatus::Excluded;
            $element->exclusion_reason = ExclusionReason::Manual;
            $element->save();
        }
    }

    /**
     * Les comptes des mandants d'abord, dans l'ordre des identifiants (ADR 0031, 7 bis).
     */
    private function lockAccounts(string $batchId): void
    {
        if (! Str::isUuid($batchId)) {
            return;
        }

        $mandants = PayoutItem::query()->where('batch_id', $batchId)->where('status', PayoutItemStatus::Pending->value)->pluck('mandant_party_id')->unique()->sort()->values();

        foreach ($mandants as $mandant) {
            $this->livre->lockParty((string) $mandant);
        }
    }
}
