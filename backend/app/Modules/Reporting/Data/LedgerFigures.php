<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

final readonly class LedgerFigures
{
    /**
     * Chiffres d'un compte rendu lus au grand livre, en unités mineures.
     *
     * @param  list<ReportLineInput>  $lines
     * @param  list<array{date: string, amount: int, reference: string}>  $executions  reversements exécutés (débit de `PayoutsInTransit`), négatif pour un retour bancaire
     */
    public function __construct(
        public int $opening,
        public int $closing,
        public int $collected,
        public int $fees,
        public int $works,
        public int $payout,
        public int $adjustments,
        public int $inTransit,
        public array $lines,
        public array $executions,
    ) {}

    /**
     * Empreinte des seuls chiffres du grand livre : stable tant que le grand livre de la période ne bouge pas.
     */
    public function hash(): string
    {
        $financieres = array_values(array_map(
            fn (ReportLineInput $l): array => [$l->kind->value, $l->date, $l->unitId, $l->leaseId, $l->amount, $l->direction->value, $l->sourceType, $l->sourceId],
            array_filter($this->lines, fn (ReportLineInput $l): bool => ! $l->kind->isInformative()),
        ));

        return hash('sha256', json_encode([$this->opening, $this->closing, $this->collected, $this->fees, $this->works, $this->payout, $this->adjustments, $financieres], JSON_THROW_ON_ERROR));
    }
}
