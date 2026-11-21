<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Enums;

enum CaseStatus: string
{
    case Open = 'open';
    case InPlan = 'in_plan';
    case Closed = 'closed';
    case Uncollectible = 'uncollectible';

    /**
     * Un dossier actif accepte des créances, des envois et des diligences ; un dossier clos ou irrécouvrable ne bouge plus.
     */
    public function isActive(): bool
    {
        return $this === self::Open || $this === self::InPlan;
    }

    /**
     * @return list<self>
     */
    public static function active(): array
    {
        return [self::Open, self::InPlan];
    }

    /**
     * @return list<self>
     */
    public function transitions(): array
    {
        return match ($this) {
            self::Open => [self::InPlan, self::Closed, self::Uncollectible],
            self::InPlan => [self::Open, self::Closed, self::Uncollectible],
            self::Closed, self::Uncollectible => [],
        };
    }
}
