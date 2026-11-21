<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum ActivityView
{
    case Rows;
    case Detail;
    case History;

    public function discloses(): bool
    {
        return $this !== self::History;
    }
}
