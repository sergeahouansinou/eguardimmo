<?php

declare(strict_types=1);

namespace App\Modules\Properties\Enums;

enum PropertyType: string
{
    case Building = 'building';
    case House = 'house';
    case Complex = 'complex';

    public function singleUnit(): bool
    {
        return $this === self::House;
    }
}
