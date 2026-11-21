<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum Confidence: string
{
    case Exact = 'exact';
    case Strong = 'strong';
    case Weak = 'weak';

    public function rank(): int
    {
        return match ($this) {
            self::Exact => 3,
            self::Strong => 2,
            self::Weak => 1,
        };
    }

    public function lowered(): self
    {
        return match ($this) {
            self::Exact => self::Strong,
            self::Strong, self::Weak => self::Weak,
        };
    }
}
