<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\Mandants;
use App\Modules\OwnerFunds\Support\PayoutEvaluator;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Money\Money;

final readonly class CreatePayoutBatch
{
    public function __construct(
        private PayoutEvaluator $evaluateur,
        private LedgerAggregates $agregats,
        private OrganizationDirectory $organisations,
        private Mandants $mandants,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Lot brouillon : aperçu serveur, un élément par mandant, inclus ou exclu avec son motif. Sans liste, tous les mandants
     * dont le compte est créditeur, dans la limite de `owner_funds.batch_max`. Un mandant déjà dans un reversement vivant
     * est écarté de la sélection automatique et refusé quand on le nomme.
     *
     * @param  list<string>|null  $mandantIds
     * @return array{batch: PayoutBatch, replayed: bool}
     */
    public function handle(?array $mandantIds, string $cle, ?string $userId, CarbonImmutable $today): array
    {
        $ids = $mandantIds === null ? null : array_values(array_unique($mandantIds));
        $empreinte = hash('sha256', (string) json_encode(['create', $ids === null ? null : $this->sorted($ids)], JSON_THROW_ON_ERROR));

        foreach ($ids ?? [] as $id) {
            $this->mandants->assertExists($id);
        }

        try {
            $resultat = $this->idempotence->run($cle, $empreinte, fn (): array => ['type' => 'payout_batch', 'id' => $this->create($ids, $cle, $empreinte, $userId, $today)->id]);
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::NotValidatable->problem('Un mandant figure déjà dans un lot de reversements en cours.');
        }

        return ['batch' => PayoutBatch::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }

    /**
     * @param  list<string>|null  $ids
     */
    private function create(?array $ids, string $cle, string $empreinte, ?string $userId, CarbonImmutable $today): PayoutBatch
    {
        $devise = $this->organisations->currency();
        $vivants = PayoutItem::query()->whereIn('status', [PayoutItemStatus::Included->value, PayoutItemStatus::Pending->value])->pluck('mandant_party_id')->all();

        if ($ids === null) {
            $comptes = array_filter($this->agregats->allOwnerFunds($devise, $today), fn ($f): bool => $f->payable->isPositive() && ! in_array($f->partyId, $vivants, true));
            uasort($comptes, fn ($a, $b): int => (int) $b->payable->getAmount() <=> (int) $a->payable->getAmount());
            $ids = array_slice(array_keys($comptes), 0, (int) config('owner_funds.batch_max'));
        } elseif (array_intersect($ids, $vivants) !== []) {
            throw ErrorCode::NotValidatable->problem('Un mandant nommé figure déjà dans un lot de reversements en cours.');
        }

        $lot = PayoutBatch::query()->create([
            'status' => PayoutBatchStatus::Draft,
            'currency' => $devise->getCode(),
            'idempotency_key' => $cle,
            'fingerprint' => $empreinte,
            'created_by_user_id' => $userId,
        ]);

        foreach ($ids as $mandantId) {
            $eval = $this->evaluateur->evaluate((string) $mandantId, $today);
            $raison = $eval->reason;

            PayoutItem::query()->create([
                'batch_id' => $lot->id,
                'mandant_party_id' => $mandantId,
                'status' => $raison === null ? PayoutItemStatus::Included : PayoutItemStatus::Excluded,
                'exclusion_reason' => $raison,
                'net_amount' => new Money($eval->net, $devise),
                'fees_settled_amount' => new Money(0, $devise),
                'currency' => $devise->getCode(),
                'bank_account_id' => $eval->account?->bankAccountId,
                'bank_last4' => $eval->account?->last4,
            ]);
        }

        $this->audit->handle('ownerfunds.batch.created', subject: $lot, metadata: ['items' => count($ids)]);

        return $lot;
    }

    /**
     * @param  list<string>  $ids
     * @return list<string>
     */
    private function sorted(array $ids): array
    {
        sort($ids);

        return $ids;
    }
}
