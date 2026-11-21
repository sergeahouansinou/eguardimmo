<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\PublicApi\DeclaredExpenses;
use App\Modules\Charges\PublicApi\ExpenseFacts;
use App\Modules\Maintenance\PublicApi\SupplierInvoiceDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Data\ExpenseRecord;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Dépenses payées d'une fenêtre, part récupérable déduite : pièces comptabilisées (grand livre pour le montant, Charges pour la catégorie
 * et le bien), dépenses déclarées, factures d'intervention imputées au propriétaire. Un relevé de syndic n'en fait pas partie : ses
 * provisions sont les paiements. Nombre de requêtes constant, quel que soit le nombre de biens.
 */
final readonly class ExpenseRecords
{
    public function __construct(
        private LedgerAggregates $grandLivre,
        private DeclaredExpenses $declarees,
        private ExpenseFacts $faits,
        private TermDirectory $termes,
        private SupplierInvoiceDirectory $factures,
        private UnitDirectory $lots,
    ) {}

    /**
     * @return list<ExpenseRecord>
     */
    public function between(CarbonImmutable $from, CarbonImmutable $toExclusive, Currency $devise): array
    {
        $comptabilisees = $this->grandLivre->itemTotals(ItemType::Expense, $devise, $from, $toExclusive->subDay());
        $declarees = $this->declarees->between($from, $toExclusive);
        $faits = $this->faits->byIds([...array_keys($comptabilisees), ...array_map(fn ($d): string => $d->id, $declarees)]);
        $parts = $this->factures->ownerSharesBetween($from, $toExclusive);
        $semantiques = $this->categories(array_values(array_unique(array_map(fn ($f): string => $f->categoryTermId, $faits))));
        $natures = $this->natures(array_values(array_unique(array_map(fn ($p): string => $p->natureTermId, $parts))));
        $enregistrements = [];

        foreach ($comptabilisees as $id => $net) {
            $fait = $faits[$id] ?? null;

            if ($fait !== null && $fait->kind !== ExpenseKind::CoOwnershipStatement->value) {
                $enregistrements[] = new ExpenseRecord($fait->propertyId, $fait->unitId, $semantiques[$fait->categoryTermId] ?? ExpenseCategorySemantic::Other->value, (int) $net->getAmount() - (int) $fait->recoverable->getAmount());
            }
        }

        foreach ($declarees as $d) {
            $enregistrements[] = new ExpenseRecord($d->propertyId, $d->unitId, $semantiques[$d->categoryTermId] ?? ExpenseCategorySemantic::Other->value, (int) $d->amount->getAmount() - (int) $d->recoverableAmount->getAmount());
        }

        $biens = $this->propertiesOfUnits(array_values(array_filter(array_map(fn ($p): ?string => $p->propertyId === null ? $p->unitId : null, $parts))));

        foreach ($parts as $part) {
            $enregistrements[] = new ExpenseRecord($part->propertyId ?? ($part->unitId === null ? null : ($biens[$part->unitId] ?? null)), $part->unitId, $natures[$part->natureTermId] ?? ExpenseCategorySemantic::Other->value, (int) $part->ownerShare->getAmount());
        }

        return array_values(array_filter($enregistrements, fn (ExpenseRecord $e): bool => $e->amount !== 0));
    }

    /**
     * @param  list<string>  $unitIds
     * @return array<string, string> bien par lot
     */
    public function propertiesOfUnits(array $unitIds): array
    {
        $biens = [];

        foreach ($this->lots->findMany(array_values(array_unique($unitIds))) as $id => $lot) {
            $biens[$id] = $lot->propertyId;
        }

        return $biens;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string>
     */
    private function categories(array $ids): array
    {
        $sens = [];

        foreach ($this->termes->findMany($ids, VocabularyKey::ExpenseCategory) as $id => $terme) {
            if ($terme->semanticKey !== null) {
                $sens[$id] = $terme->semanticKey;
            }
        }

        return $sens;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string>
     */
    private function natures(array $ids): array
    {
        $sens = [];

        foreach ($this->termes->findMany($ids, VocabularyKey::InterventionNature) as $id => $terme) {
            $valeur = $terme->metadata['expense_semantic'] ?? null;

            if (is_string($valeur) && $valeur !== '') {
                $sens[$id] = $valeur;
            }
        }

        return $sens;
    }
}
