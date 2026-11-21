<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\EmailChangeRequest;
use Carbon\CarbonInterface;

final readonly class PurgeEmailChanges
{
    /**
     * Les codes de changement d'adresse ne se conservent pas au-delà de 24 heures (ADR 0036, décision 11).
     */
    public function handle(CarbonInterface $now): int
    {
        return EmailChangeRequest::query()->where('created_at', '<', $now->copy()->subDay())->delete();
    }
}
