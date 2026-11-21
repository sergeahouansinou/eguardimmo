<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Queries\Mandates;
use Illuminate\Support\Facades\DB;

final readonly class RestoreMandate
{
    public function __construct(private Mandates $mandats) {}

    public function handle(Mandate $mandate): Mandate
    {
        return DB::transaction(function () use ($mandate): Mandate {
            $courant = $this->mandats->locked($mandate->id);

            if ($courant->archived_at !== null) {
                $courant->archived_at = null;
                $courant->save();
            }

            return $courant;
        });
    }
}
