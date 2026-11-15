<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;

final class PartyGuard
{
    public static function editable(Party $party): void
    {
        if ($party->isAnonymized()) {
            throw ErrorCode::PartyAnonymized->problem();
        }
    }
}
