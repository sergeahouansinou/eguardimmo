<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use Carbon\CarbonImmutable;
use Money\Money;

final readonly class InstallmentDraft
{
    /**
     * @param  list<DraftLine>  $lines
     */
    public function __construct(
        public CarbonImmutable $periodStart,
        public CarbonImmutable $periodEnd,
        public CarbonImmutable $occupiedFrom,
        public array $lines,
        public Money $rent,
        public Money $charges,
        public Money $vat,
        public Money $total,
    ) {}

    /**
     * Ajoute des lignes de charges (régularisation) : les totaux suivent, le loyer et la TVA ne bougent pas.
     *
     * @param  list<DraftLine>  $supplementaires
     */
    public function withChargeLines(array $supplementaires): self
    {
        $charges = $this->charges;

        foreach ($supplementaires as $ligne) {
            $charges = $charges->add($ligne->amount);
        }

        return new self($this->periodStart, $this->periodEnd, $this->occupiedFrom, [...$this->lines, ...$supplementaires], $this->rent, $charges, $this->vat, $this->rent->add($charges)->add($this->vat));
    }
}
