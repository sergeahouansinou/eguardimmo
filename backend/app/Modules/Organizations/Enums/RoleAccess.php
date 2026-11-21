<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum RoleAccess: string
{
    case None = 'none';
    case Read = 'read';
    case Prepare = 'prepare';
    case Write = 'write';
    case WriteTwoFactor = 'write_two_factor';

    public function canRead(): bool
    {
        return $this !== self::None;
    }

    public function canChange(): bool
    {
        return in_array($this, [self::Prepare, self::Write, self::WriteTwoFactor], true);
    }
}
