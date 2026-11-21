<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ScanVerdict;

final class NullScanner implements MalwareScanner
{
    public function scan($flux): ScanVerdict
    {
        return ScanVerdict::Clean;
    }

    public function enabled(): bool
    {
        return false;
    }
}
