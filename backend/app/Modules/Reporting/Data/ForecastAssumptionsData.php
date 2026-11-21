<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

final readonly class ForecastAssumptionsData
{
    public const int PERCENT_SCALE = 100000;

    /**
     * Taux en millièmes de pour cent (3,200 % : 3200).
     *
     * @param  list<array{unit_id: string, from: string, to: string}>  $vacancies  `to` inclus
     * @param  list<array{month: string, label: string, amount: int}>  $oneOffExpenses
     */
    public function __construct(
        public int $indexationMilli,
        public int $growthMilli,
        public array $vacancies,
        public array $oneOffExpenses,
        public int $lockVersion,
    ) {}

    public static function empty(): self
    {
        return new self(0, 0, [], [], 0);
    }

    public static function milli(string $decimal): int
    {
        [$entier, $fraction] = array_pad(explode('.', $decimal, 2), 2, '');

        return (int) $entier * 1000 + (int) str_pad(substr($fraction, 0, 3), 3, '0');
    }

    public static function decimal(int $milli): string
    {
        return sprintf('%d.%03d', intdiv($milli, 1000), $milli % 1000);
    }
}
