<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Support\Facades\DB;

final readonly class RestoreLease
{
    public function __construct(private Leases $baux) {}

    public function handle(Lease $bail): Lease
    {
        return DB::transaction(function () use ($bail): Lease {
            $courant = $this->baux->locked($bail->id);

            if ($courant->archived_at === null) {
                return $courant;
            }

            $courant->archived_at = null;
            $courant->save();

            return $courant;
        });
    }
}
