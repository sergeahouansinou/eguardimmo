<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Modules\Properties\PublicApi\OwnershipDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Tax\Data\FormDefinition;
use App\Modules\Tax\Data\IncomeFacts;
use App\Modules\Tax\Jurisdictions\RentalIncomeRules;
use App\Modules\Tax\Support\Facts\ExpenseSource;
use App\Modules\Tax\Support\Facts\LeaseUniverse;
use App\Modules\Tax\Support\Facts\LoanSource;
use App\Modules\Tax\Support\Facts\RentSource;
use App\Modules\Tax\Support\Facts\YearWindow;
use Money\Currency;

/**
 * Rassemble, pour le bailleur autonome, les montants de l'année lus dans les autres modules (ADR 0039, 6). Lecture seule : rien n'est écrit,
 * rien n'est classé d'office.
 */
final readonly class LandlordFactsReader
{
    public function __construct(
        private LeaseUniverse $baux,
        private RentSource $loyers,
        private ExpenseSource $depenses,
        private LoanSource $prets,
        private OwnershipDirectory $droits,
        private UnitDirectory $lots,
    ) {}

    /**
     * @return array{facts: IncomeFacts, loanIds: list<string>}
     */
    public function read(int $annee, Currency $devise, FormDefinition $formulaire, RentalIncomeRules $regles): array
    {
        $fenetre = YearWindow::of($annee);
        $encaissements = $this->loyers->collect($fenetre, $devise);
        $leaseIds = array_values(array_unique(array_filter(array_map(fn ($l): ?string => $l->leaseId, $encaissements))));
        $univers = (clone $this->baux)->load($fenetre, $regles, $leaseIds);
        $loyers = $this->loyers->classify($encaissements, $univers);
        $depenses = $this->depenses->read($fenetre, $devise, $formulaire, array_map(fn ($u): string => $u->propertyId, $univers->units));
        $prets = $this->prets->read($annee, $depenses['interest']);
        $locaux = $univers->rentedMainUnits($fenetre);
        $noms = $univers->propertyNames();

        foreach ([...array_keys($depenses['interest']), ...$depenses['properties'], ...array_map(fn ($e): string => $e->propertyId, $prets['entries'])] as $bien) {
            if (! isset($noms[$bien])) {
                $noms[$bien] = $this->lots->findProperty($bien)->name;
            }
        }

        $parts = $this->droits->ownersAtMany(array_merge(...array_values($locaux) ?: [[]]), $fenetre->last);
        $copropriete = [];

        foreach ($locaux as $bien => $lotIds) {
            $droits = $parts[$lotIds[0]] ?? [];

            if (count($droits) > 1) {
                $copropriete[$bien] = array_map(fn ($d): array => ['share_bp' => $d->shareBp, 'nature' => $d->nature->value], $droits);
            }
        }

        return [
            'facts' => new IncomeFacts(
                [...$loyers['entries'], ...$depenses['entries'], ...$prets['entries']],
                $noms,
                array_map('count', $locaux),
                $copropriete,
                [...$loyers['warnings'], ...$depenses['warnings']],
                $prets['blockers'],
            ),
            'loanIds' => $prets['loanIds'],
        ];
    }
}
