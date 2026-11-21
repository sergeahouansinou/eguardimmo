<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Own;

use App\Modules\Reporting\Models\ManagementReport;

/**
 * Pose `first_read_at` une seule fois : la mise à jour conditionnelle tient l'idempotence sans verrou.
 */
final readonly class ReportReadMark
{
    public function place(string $reportId): bool
    {
        return ManagementReport::query()->whereKey($reportId)->whereNull('first_read_at')->update(['first_read_at' => now()]) === 1;
    }
}
