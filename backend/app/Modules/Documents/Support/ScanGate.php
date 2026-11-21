<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\ScanStatus;
use App\Modules\Documents\Models\StoredFile;

final class ScanGate
{
    /**
     * Seul un fichier `clean` se lit : `pending` et `unverifiable` répondent 409, `infected` 410.
     */
    public static function assertReadable(StoredFile $fichier): void
    {
        match ($fichier->scan_status) {
            ScanStatus::Clean => null,
            ScanStatus::Infected => throw ErrorCode::AttachmentInfected->problem(),
            ScanStatus::Pending, ScanStatus::Unverifiable => throw ErrorCode::AttachmentNotReady->problem(),
        };
    }
}
