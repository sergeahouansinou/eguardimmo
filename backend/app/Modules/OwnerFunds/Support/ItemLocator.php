<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use Illuminate\Support\Str;

/**
 * Prend les verrous dans l'ordre fixe de l'ADR 0031 (7 bis) : compte du mandant, puis lot, puis élément.
 */
final readonly class ItemLocator
{
    public function __construct(private Ledger $livre) {}

    /**
     * À appeler dans la transaction de l'appelant.
     *
     * @return array{0: PayoutBatch, 1: PayoutItem}
     */
    public function lock(string $batchId, string $itemId): array
    {
        $mandant = Str::isUuid($itemId) && Str::isUuid($batchId)
            ? PayoutItem::query()->whereKey($itemId)->where('batch_id', $batchId)->value('mandant_party_id')
            : null;

        if (! is_string($mandant)) {
            throw ErrorCode::ItemNotFound->problem();
        }

        $this->livre->lockParty($mandant);
        $lot = PayoutBatch::query()->whereKey($batchId)->lockForUpdate()->firstOrFail();
        $element = PayoutItem::query()->whereKey($itemId)->lockForUpdate()->firstOrFail();

        return [$lot, $element];
    }
}
