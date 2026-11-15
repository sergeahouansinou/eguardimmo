<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

enum SubjectType: string
{
    case Organization = 'organization';
    case Unit = 'unit';
    case Party = 'party';
    case Equipment = 'equipment';
    case Lease = 'lease';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $type): string => $type->value, self::cases());
    }
}
