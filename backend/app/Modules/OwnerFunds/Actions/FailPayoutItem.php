<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Events\PayoutFailed;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\ItemLocator;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;

final readonly class FailPayoutItem
{
    public function __construct(
        private ItemLocator $verrous,
        private Ledger $livre,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Virement refusé avant exécution : la validation est contrepassée, le compte du mandant est recrédité.
     *
     * @return array{item: PayoutItem, replayed: bool}
     */
    public function handle(string $batchId, string $itemId, string $motif, string $cle, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', (string) json_encode(['fail', $batchId, $itemId, $motif], JSON_THROW_ON_ERROR));
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($batchId, $itemId, $motif, $today): array {
            [$lot, $element] = $this->verrous->lock($batchId, $itemId);

            if ($element->status !== PayoutItemStatus::Pending || $element->transit_entry_id === null) {
                throw ErrorCode::ItemNotActionable->problem();
            }

            $this->livre->reverse($element->transit_entry_id, $today);
            $element->status = PayoutItemStatus::Failed;
            $element->failure_reason = $motif;
            $element->save();
            $this->settleBatch($lot);
            $this->audit->handle('ownerfunds.payout.failed', subject: $element, metadata: ['batch_id' => $lot->id]);
            PayoutFailed::dispatch($element->organization_id, $lot->id, $element->id, (string) $lot->number);

            return ['type' => 'payout_item', 'id' => $element->id];
        });

        return ['item' => PayoutItem::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }

    private function settleBatch(PayoutBatch $lot): void
    {
        $items = PayoutItem::query()->where('batch_id', $lot->id)->pluck('status');

        if ($items->contains(PayoutItemStatus::Pending) || $lot->status !== PayoutBatchStatus::Validated) {
            return;
        }

        $lot->status = $items->contains(PayoutItemStatus::Paid) ? PayoutBatchStatus::Executed : PayoutBatchStatus::Cancelled;
        $lot->cancelled_at = $lot->status === PayoutBatchStatus::Cancelled ? now() : null;
        $lot->cancel_reason = $lot->status === PayoutBatchStatus::Cancelled ? 'Aucun reversement exécuté' : null;
        $lot->lock_version++;
        $lot->save();
    }
}
