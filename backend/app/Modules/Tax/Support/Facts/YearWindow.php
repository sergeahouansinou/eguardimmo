<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support\Facts;

use Carbon\CarbonImmutable;

/**
 * Année civile de revenus en intervalle semi-ouvert [début, fin) : le dernier jour inclus est la veille de `$toExclusive`.
 */
final readonly class YearWindow
{
    public function __construct(
        public int $year,
        public CarbonImmutable $from,
        public CarbonImmutable $toExclusive,
        public CarbonImmutable $last,
    ) {}

    public static function of(int $year): self
    {
        $debut = CarbonImmutable::createFromDate($year, 1, 1)->startOfDay();

        return new self($year, $debut, $debut->addYear(), $debut->addYear()->subDay());
    }

    public function previous(): self
    {
        return self::of($this->year - 1);
    }
}
