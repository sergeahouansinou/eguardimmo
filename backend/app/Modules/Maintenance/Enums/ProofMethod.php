<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum ProofMethod: string
{
    case Totp = 'totp';
    case RecoveryCode = 'recovery_code';
}
