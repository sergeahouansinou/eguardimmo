<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum MemberRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Manager = 'manager';
    case Accountant = 'accountant';

    public function managesTeam(): bool
    {
        return $this === self::Owner || $this === self::Admin;
    }

    /**
     * @return list<string>
     */
    public static function invitable(): array
    {
        return [self::Admin->value, self::Manager->value, self::Accountant->value];
    }
}
