<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

trait RetriesWithBackoff
{
    public int $tries = 5;

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }
}
