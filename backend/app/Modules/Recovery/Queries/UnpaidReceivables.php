<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Recovery\Data\Receivable;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Support\Receivables;
use App\Modules\Recovery\Support\UnpaidPage;
use Carbon\CarbonImmutable;

final readonly class UnpaidReceivables
{
    public function __construct(
        private Receivables $creances,
        private LeaseDirectory $baux,
        private PartyDirectory $parties,
        private OpenItems $pris,
    ) {}

    /**
     * Impayés échus de l'organisation (échéances lues par `RentLedger`, factures par `InvoiceLedger`, jamais dans leurs
     * tables), mêlés par identifiant croissant : repartir de `nextAfter` pour la page suivante. Chaque ligne dit si sa
     * créance est déjà dans un dossier actif.
     */
    public function page(CarbonImmutable $today, ?string $leaseId, ?string $after, int $perPage): UnpaidPage
    {
        $lues = $this->creances->overdue($today, $leaseId, $after, $perPage + 1);
        $suite = count($lues) > $perPage;
        $items = array_slice($lues, 0, $perPage);

        if ($items === []) {
            return new UnpaidPage([], [], [], [], null);
        }

        $baux = [];

        foreach ($this->baux->findMany(array_values(array_unique(array_map(fn (Receivable $i): string => $i->leaseId, $items)))) as $bail) {
            $baux[$bail->id] = $bail;
        }

        $idsParties = array_values(array_unique(array_filter(array_map(fn (Receivable $i): ?string => $i->partyId, $items))));
        $pris = $this->pris->takenByReceivables($items);
        $numeros = $pris === [] ? [] : RecoveryCase::query()->whereIn('id', array_values(array_unique($pris)))->pluck('number', 'id')->all();
        $dossiers = [];

        foreach ($pris as $creance => $dossier) {
            $dossiers[$creance] = ['id' => $dossier, 'number' => (string) ($numeros[$dossier] ?? '')];
        }

        return new UnpaidPage(
            $items,
            $baux,
            $idsParties === [] ? [] : $this->parties->findMany($idsParties),
            $dossiers,
            $suite ? $items[array_key_last($items)]->id : null,
        );
    }
}
