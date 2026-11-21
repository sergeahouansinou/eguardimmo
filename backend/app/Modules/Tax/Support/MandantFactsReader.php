<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Modules\Accounting\Data\PartyStatementLineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Properties\PublicApi\OwnershipDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Tax\Data\FactEntryData;
use App\Modules\Tax\Data\FormDefinition;
use App\Modules\Tax\Data\IncomeFacts;
use App\Modules\Tax\Support\Facts\ExpenseSource;
use App\Modules\Tax\Support\Facts\LeaseUniverse;
use App\Modules\Tax\Support\Facts\YearWindow;
use Money\Currency;

/**
 * Faits d'un mandant pour l'année : loyers appelés puis encaissés sur ses comptes, honoraires prélevés, dépenses et factures qui lui sont
 * rattachées, sur les lots que ses mandats couvrent. Les prêts, que l'agence ne connaît pas, restent « à compléter » (ADR 0039, 6).
 */
final readonly class MandantFactsReader
{
    public function __construct(
        private LedgerAggregates $grandLivre,
        private MandateDirectory $mandats,
        private UnitDirectory $lots,
        private ExpenseSource $depenses,
        private OwnershipDirectory $droits,
    ) {}

    /**
     * Null : aucun mandat du mandant ne couvre un jour de l'année.
     */
    public function read(string $mandantId, YearWindow $annee, Currency $devise, FormDefinition $formulaire, LeaseUniverse $univers): ?IncomeFacts
    {
        $couvertures = $this->mandats->coverageDuring($annee->from, $annee->last, [$mandantId]);
        $lotIds = array_values(array_unique(array_map(fn ($c): string => $c->unitId, $couvertures)));

        if ($lotIds === []) {
            return null;
        }

        $lots = $this->lots->findMany($lotIds);
        $biens = array_map(fn ($l): string => $l->propertyId, $lots);
        $noms = [];

        foreach ($lots as $lot) {
            $noms[$lot->propertyId] = $lot->propertyName;
        }

        $entrees = [];
        $avertissements = [];

        foreach ($this->grandLivre->movements([AccountRole::OwnerRentCalled], $devise, $annee->from, $annee->last, [$mandantId], $lotIds, [SourceType::Payment]) as $m) {
            $net = (int) $m->debit->getAmount() - (int) $m->credit->getAmount();

            if ($net !== 0 && isset($biens[(string) $m->unitId])) {
                $entrees[] = new FactEntryData($biens[(string) $m->unitId], '211', $net, FactEntryData::RENT);
            }
        }

        $uniqueBien = count(array_unique($biens)) === 1 ? array_values($biens)[0] : null;

        foreach ($this->grandLivre->partyStatement($mandantId, AccountRole::OwnerPayable, $devise, $annee->from, $annee->last)->lines as $l) {
            $net = $this->honoraires($l);

            if ($net === 0) {
                continue;
            }

            $bien = $l->unitId !== null && isset($biens[$l->unitId]) ? $biens[$l->unitId] : $uniqueBien;
            $bien !== null
                ? $entrees[] = new FactEntryData($bien, '221', $net, FactEntryData::FEES, $l->reference)
                : $avertissements[] = ['code' => 'unattributed_fee', 'property_id' => null, 'amount' => $net];
        }

        $depenses = $this->depenses->read($annee, $devise, $formulaire, $biens, $mandantId);
        array_push($entrees, ...$depenses['entries']);
        array_push($avertissements, ...$depenses['warnings']);

        $locaux = [];

        foreach ($univers->rentedMainUnits($annee) as $bien => $ids) {
            $retenus = array_values(array_intersect($ids, $lotIds));
            $retenus === [] || $locaux[$bien] = $retenus;
        }

        $parts = $this->droits->ownersAtMany(array_merge(...array_values($locaux) ?: [[]]), $annee->last);
        $copropriete = [];

        foreach ($locaux as $bien => $ids) {
            $droits = $parts[$ids[0]] ?? [];

            if (count($droits) > 1) {
                $copropriete[$bien] = array_map(fn ($d): array => ['share_bp' => $d->shareBp, 'nature' => $d->nature->value], $droits);
            }
        }

        return new IncomeFacts($entrees, $noms, array_map('count', $locaux), $copropriete, $avertissements, []);
    }

    /**
     * Honoraires prélevés sur le compte du mandant, TTC : règlement d'une facture d'honoraires (débit, ou crédit si c'est son extourne),
     * décompte d'honoraires, avoir. Un encaissement de loyer ou une avance sont l'inverse et ne comptent pas.
     */
    private function honoraires(PartyStatementLineData $ligne): int
    {
        $debit = (int) $ligne->debit->getAmount();
        $credit = (int) $ligne->credit->getAmount();

        return match ($ligne->source) {
            SourceType::FeeSettlement, SourceType::CreditNote, SourceType::Invoice => $debit - $credit,
            SourceType::Payment => $ligne->isReversal ? -$credit : ($debit > 0 ? $debit : 0),
            default => 0,
        };
    }
}
