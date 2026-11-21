<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveLease
{
    public function __construct(private Leases $baux) {}

    public function handle(Lease $bail): Lease
    {
        return DB::transaction(function () use ($bail): Lease {
            $courant = $this->baux->locked($bail->id);

            if ($courant->archived_at !== null) {
                return $courant;
            }

            $finEffective = $courant->effectiveEnd();

            if ($courant->status === LeaseStatus::Signed || ($courant->status === LeaseStatus::Terminated && $finEffective !== null && $finEffective > now()->toDateString())) {
                throw ErrorCode::LeaseNotArchivable->problem();
            }

            $courant->archived_at = now();
            $courant->save();

            return $courant;
        });
    }
}
