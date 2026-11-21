<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Modules\Recovery\Data\Receivable;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Rent\PublicApi\RentLedger;
use Carbon\CarbonImmutable;
use Closure;

/**
 * Créances recouvrables d'un bail : les échéances que Rent déclare échues et non soldées, et les factures de bail
 * échues et non soldées d'Invoicing, avec le reste dû lu au grand livre.
 */
final readonly class Receivables
{
    private const int PAGE = 500;

    public function __construct(
        private RentLedger $loyers,
        private InvoiceLedger $factures,
    ) {}

    /**
     * Impayés échus des deux sources, par identifiant croissant : repartir de l'identifiant de la dernière reçue.
     *
     * @return list<Receivable>
     */
    public function overdue(CarbonImmutable $today, ?string $leaseId, ?string $afterId, int $limit): array
    {
        $creances = [
            ...array_map(Receivable::fromInstallment(...), $this->loyers->unpaidInstallments($today, $leaseId, $afterId, $limit)),
            ...array_map(Receivable::fromInvoice(...), $this->factures->unpaidByLease($today, $leaseId, $afterId, $limit)),
        ];
        usort($creances, fn (Receivable $a, Receivable $b): int => strcmp($a->id, $b->id));

        return array_slice($creances, 0, $limit);
    }

    /**
     * Échéances puis factures, dans l'ordre demandé, doublons écartés ; lève recovery_receivable_invalid si l'une n'est
     * pas un impayé échu de ce bail.
     *
     * @param  list<string>  $installmentIds
     * @param  list<string>  $invoiceIds
     * @return list<Receivable>
     */
    public function collectible(string $leaseId, array $installmentIds, array $invoiceIds, CarbonImmutable $today): array
    {
        return [
            ...$this->scan(array_values(array_unique($installmentIds)), fn (?string $apres): array => array_map(Receivable::fromInstallment(...), $this->loyers->unpaidInstallments($today, $leaseId, $apres, self::PAGE))),
            ...$this->scan(array_values(array_unique($invoiceIds)), fn (?string $apres): array => array_map(Receivable::fromInvoice(...), $this->factures->unpaidByLease($today, $leaseId, $apres, self::PAGE))),
        ];
    }

    /**
     * @param  list<string>  $voulues
     * @param  Closure(?string): list<Receivable>  $page
     * @return list<Receivable>
     */
    private function scan(array $voulues, Closure $page): array
    {
        if ($voulues === []) {
            return [];
        }

        $trouvees = [];
        $apres = null;

        do {
            $lues = $page($apres);

            foreach ($lues as $creance) {
                if ($creance->outstanding->isPositive() && in_array($creance->id, $voulues, true)) {
                    $trouvees[$creance->id] = $creance;
                }
            }

            $apres = $lues === [] ? null : $lues[array_key_last($lues)]->id;
        } while (count($lues) === self::PAGE && count($trouvees) < count($voulues));

        return array_map(fn (string $id): Receivable => $trouvees[$id] ?? throw ErrorCode::ReceivableInvalid->problem(), $voulues);
    }
}
