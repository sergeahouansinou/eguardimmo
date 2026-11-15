<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Models\Party;
use Illuminate\Support\Facades\DB;

final readonly class RestoreParty
{
    public function handle(Party $party): Party
    {
        return DB::transaction(function () use ($party): Party {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            if ($partie->archived_at !== null) {
                $partie->archived_at = null;
                $partie->save();
            }

            return $partie;
        });
    }
}
