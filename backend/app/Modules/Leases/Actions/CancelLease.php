<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\CancelLeaseData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Support\Facades\DB;

final readonly class CancelLease
{
    public function __construct(private Leases $baux) {}

    public function handle(Lease $bail, CancelLeaseData $donnees): Lease
    {
        return DB::transaction(function () use ($bail, $donnees): Lease {
            $courant = $this->baux->locked($bail->id);

            if ($courant->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::LeaseStaleVersion->problem();
            }

            if ($courant->status !== LeaseStatus::Draft) {
                throw ErrorCode::LeaseNotDraft->problem();
            }

            $courant->status = LeaseStatus::Cancelled;
            $courant->lock_version = $courant->lock_version + 1;
            $courant->save();

            return $courant;
        });
    }
}
