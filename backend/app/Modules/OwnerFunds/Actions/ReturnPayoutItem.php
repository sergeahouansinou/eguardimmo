<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Events\PayoutReturned;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\ItemLocator;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;

final readonly class ReturnPayoutItem
{
    public function __construct(
        private ItemLocator $verrous,
        private Ledger $livre,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Retour bancaire d'un virement exécuté : l'exécution puis la validation sont contrepassées, le compte du mandant
     * est recrédité. Un virement exécuté ne se défait que par ce retour.
     *
     * @return array{item: PayoutItem, replayed: bool}
     */
    public function handle(string $batchId, string $itemId, string $motif, string $cle, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', (string) json_encode(['return', $batchId, $itemId, $motif], JSON_THROW_ON_ERROR));
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($batchId, $itemId, $motif, $today): array {
            [$lot, $element] = $this->verrous->lock($batchId, $itemId);

            if ($element->status !== PayoutItemStatus::Paid || $element->execution_entry_id === null || $element->transit_entry_id === null) {
                throw ErrorCode::ItemNotActionable->problem();
            }

            $retour = $this->livre->reverse($element->execution_entry_id, $today);
            $this->livre->reverse($element->transit_entry_id, $today);
            $element->status = PayoutItemStatus::Returned;
            $element->return_entry_id = $retour->id;
            $element->failure_reason = $motif;
            $element->save();
            $this->audit->handle('ownerfunds.payout.returned', subject: $element, metadata: ['batch_id' => $lot->id]);
            PayoutReturned::dispatch($element->organization_id, $lot->id, $element->id, (string) $lot->number, $element->mandant_party_id);

            return ['type' => 'payout_item', 'id' => $element->id];
        });

        return ['item' => PayoutItem::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
