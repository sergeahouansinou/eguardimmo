<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\BatchNumbers;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\SecondApproval;
use App\Modules\OwnerFunds\Support\TrustGuard;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class ValidatePayoutBatch
{
    public function __construct(
        private ValidatePayoutItem $element,
        private TrustGuard $cantonnement,
        private BatchNumbers $numeros,
        private SecondApproval $doubleControle,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Valide chaque mandant inclus dans sa propre transaction ; le lot passe à `validated` dès qu'un reversement est en
     * attente d'exécution. Un écart de cantonnement bloque tout le lot. Sans reversement validé, le lot reste brouillon
     * et ses éléments portent leur motif.
     *
     * @return array{batch: PayoutBatch, replayed: bool}
     */
    public function handle(string $batchId, int $lockVersion, string $cle, ?string $userId, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', "validate|{$batchId}|{$lockVersion}");

        if ($this->idempotence->find($cle, $empreinte) !== null) {
            return ['batch' => $this->find($batchId), 'replayed' => true];
        }

        $lot = $this->find($batchId);

        if ($lot->lock_version !== $lockVersion) {
            throw ErrorCode::StaleVersion->problem();
        }

        $inclus = PayoutItem::query()->where('batch_id', $lot->id)->where('status', PayoutItemStatus::Included->value)->orderBy('id')->pluck('id');

        if ($lot->status !== PayoutBatchStatus::Draft || $inclus->isEmpty()) {
            throw ErrorCode::NotValidatable->problem();
        }

        $this->cantonnement->assertCovered();
        $attente = 0;

        foreach ($inclus as $itemId) {
            $attente += $this->element->handle((string) $itemId, $userId, $today) === PayoutItemStatus::Pending ? 1 : 0;
        }

        return DB::transaction(function () use ($lot, $attente, $userId, $today, $cle, $empreinte): array {
            $lot = PayoutBatch::query()->whereKey($lot->id)->lockForUpdate()->firstOrFail();

            if ($attente > 0 && $lot->status === PayoutBatchStatus::Draft) {
                $lot->status = PayoutBatchStatus::Validated;
                $lot->number = $this->numeros->next($today);
                $lot->validated_at = now();
                $lot->validated_by_user_id = $userId;
                $instantane = $this->doubleControle->snapshot();
                $lot->second_approver_required = $instantane['required'];
                $lot->approvers_count = $instantane['count'];
                $lot->lock_version++;
                $lot->save();
                $this->audit->handle('ownerfunds.batch.validated', subject: $lot, metadata: ['number' => $lot->number, 'pending_items' => $attente]);
            }

            try {
                $this->idempotence->remember($cle, $empreinte, 'payout_batch', $lot->id);
            } catch (UniqueConstraintViolationException) {
                // Une requête identique et concurrente a déjà enregistré la clé : même résultat.
            }

            return ['batch' => $lot, 'replayed' => false];
        });
    }

    private function find(string $batchId): PayoutBatch
    {
        return (Str::isUuid($batchId) ? PayoutBatch::query()->find($batchId) : null) ?? throw ErrorCode::BatchNotFound->problem();
    }
}
