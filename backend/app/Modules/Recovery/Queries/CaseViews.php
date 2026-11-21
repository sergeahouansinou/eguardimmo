<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Support\CaseView;

final readonly class CaseViews
{
    public function __construct(
        private LeaseDirectory $baux,
        private PartyDirectory $parties,
        private OutstandingAmounts $restes,
    ) {}

    /**
     * Les dossiers portent leurs lignes (`items`) : le reste dû n'est lu que pour les lignes ouvertes.
     *
     * @param  list<RecoveryCase>  $dossiers
     */
    public function of(array $dossiers): CaseView
    {
        if ($dossiers === []) {
            return new CaseView([], [], []);
        }

        $baux = $this->baux->findMany(array_values(array_unique(array_map(fn (RecoveryCase $d): string => $d->lease_id, $dossiers))));
        $parties = $this->parties->findMany(array_values(array_unique(array_map(fn (RecoveryCase $d): string => $d->debtor_party_id, $dossiers))));
        $ouvertes = [];

        foreach ($dossiers as $dossier) {
            foreach ($dossier->items->whereNull('removed_at') as $ligne) {
                /** @var RecoveryCaseItem $ligne */
                $ouvertes[] = $ligne;
            }
        }

        $leases = [];

        foreach ($baux as $bail) {
            $leases[$bail->id] = $bail;
        }

        return new CaseView($leases, $parties, $this->restes->of($ouvertes));
    }
}
