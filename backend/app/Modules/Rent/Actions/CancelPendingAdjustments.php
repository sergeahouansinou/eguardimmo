<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\AdjustmentStatus;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\RentAdjustment;
use App\Modules\Rent\Support\Schedules;
use Illuminate\Support\Facades\DB;

final readonly class CancelPendingAdjustments
{
    public function __construct(private Schedules $echeanciers) {}

    /**
     * Retire les lignes en attente d'un décompte pour les remplacer (douzièmes). Refuse dès qu'une ligne figure sur une échéance.
     * À appeler dans la transaction de l'appelant ; sans effet sur un décompte sans ligne.
     *
     * @return int nombre de lignes retirées
     */
    public function handle(string $leaseId, string $sourceId): int
    {
        return DB::transaction(function () use ($leaseId, $sourceId): int {
            $this->echeanciers->lockExisting($leaseId);
            $lignes = RentAdjustment::query()->where('source_type', ScheduleAdjustments::SOURCE_STATEMENT)->where('source_id', $sourceId)->lockForUpdate()->get();

            if ($lignes->contains(fn (RentAdjustment $l): bool => $l->status === AdjustmentStatus::Billed)) {
                throw ErrorCode::AdjustmentBilled->problem();
            }

            $retirees = 0;

            foreach ($lignes->filter(fn (RentAdjustment $l): bool => $l->status === AdjustmentStatus::Pending) as $ligne) {
                $ligne->status = AdjustmentStatus::Cancelled;
                $ligne->save();
                $retirees++;
            }

            return $retirees;
        });
    }
}
