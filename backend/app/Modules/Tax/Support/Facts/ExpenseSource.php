<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support\Facts;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Charges\Data\ExpenseFactData;
use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\PublicApi\DeclaredExpenses;
use App\Modules\Charges\PublicApi\ExpenseFacts;
use App\Modules\Maintenance\PublicApi\SupplierInvoiceDirectory;
use App\Modules\Tax\Data\FactEntryData;
use App\Modules\Tax\Data\FormDefinition;
use Money\Currency;

/**
 * Dépenses payées dans l'année : pièces comptabilisées (grand livre pour le montant, Charges pour la catégorie et le bien), dépenses
 * déclarées, factures d'intervention imputées au propriétaire. Une catégorie sans ligne (`other`, `utilities`) est listée, jamais rangée.
 */
final readonly class ExpenseSource
{
    public function __construct(
        private LedgerAggregates $grandLivre,
        private DeclaredExpenses $declarees,
        private ExpenseFacts $faits,
        private TermDirectory $termes,
        private SupplierInvoiceDirectory $factures,
    ) {}

    /**
     * @param  array<string, string>  $unitProperties  bien par lot connu ; pour un mandant, les lots que ses mandats couvrent
     * @param  string|null  $mandantId  seulement les pièces rattachées à ce mandant (relevé d'agence)
     * @return array{entries: list<FactEntryData>, interest: array<string, list<FactEntryData>>, warnings: list<array{code: string, property_id: ?string, amount?: int, detail?: string}>, properties: list<string>}
     */
    public function read(YearWindow $annee, Currency $devise, FormDefinition $formulaire, array $unitProperties, ?string $mandantId = null): array
    {
        $comptabilisees = $this->grandLivre->itemTotals(ItemType::Expense, $devise, $annee->from, $annee->last);
        $declarees = $this->declarees->between($annee->from, $annee->toExclusive);
        $faits = $this->faits->byIds([...array_keys($comptabilisees), ...array_map(fn ($d): string => $d->id, $declarees)]);
        $semantiques = $this->categories(array_values(array_unique(array_map(fn (ExpenseFactData $f): string => $f->categoryTermId, $faits))));
        $entrees = [];
        $interets = [];
        $avertissements = [];
        $biens = [];

        $pieces = [];

        foreach ($comptabilisees as $id => $net) {
            $pieces[] = [$id, (int) $net->getAmount(), FactEntryData::EXPENSE];
        }

        foreach ($declarees as $d) {
            $pieces[] = [$d->id, (int) $d->amount->getAmount(), FactEntryData::DECLARED_EXPENSE];
        }

        foreach ($pieces as [$id, $montant, $genre]) {
            $fait = $faits[$id] ?? null;

            if ($fait === null || $fait->kind === ExpenseKind::CoOwnershipStatement->value || $montant === 0 || ($mandantId !== null && $fait->mandantPartyId !== $mandantId)) {
                continue;
            }

            $biens[$fait->propertyId] = $fait->propertyId;
            $semantique = $semantiques[$fait->categoryTermId] ?? null;
            $ligne = $semantique === null ? null : $formulaire->lineForCategory($semantique);

            if ($ligne === null) {
                $avertissements[] = ['code' => 'unclassified_expense', 'property_id' => $fait->propertyId, 'amount' => $montant, 'detail' => $id];

                continue;
            }

            if ($ligne === '227') {
                $montant -= (int) $fait->recoverable->getAmount();
            }

            $entree = new FactEntryData($fait->propertyId, $ligne, $montant, $genre, $id);
            $semantique === ExpenseCategorySemantic::LoanInterest->value ? $interets[$fait->propertyId][] = $entree : $entrees[] = $entree;
        }

        foreach ($this->supplierInvoices($annee, $formulaire, $unitProperties, $mandantId !== null) as $resultat) {
            $resultat instanceof FactEntryData ? $entrees[] = $resultat : $avertissements[] = $resultat;
            $resultat instanceof FactEntryData && $biens[$resultat->propertyId] = $resultat->propertyId;
        }

        array_push($entrees, ...$this->coOwnershipRegularization($annee, $devise, $formulaire, $mandantId));

        return ['entries' => $entrees, 'interest' => $interets, 'warnings' => $avertissements, 'properties' => array_values($biens)];
    }

    /**
     * @param  array<string, string>  $unitProperties
     * @return list<FactEntryData|array{code: string, property_id: ?string, amount: int, detail: string}>
     */
    private function supplierInvoices(YearWindow $annee, FormDefinition $formulaire, array $unitProperties, bool $parMandant): array
    {
        $parts = $this->factures->ownerSharesBetween($annee->from, $annee->toExclusive);
        $natures = $this->natures(array_values(array_unique(array_map(fn ($p): string => $p->natureTermId, $parts))));
        $sortie = [];

        foreach ($parts as $part) {
            if ($parMandant && ($part->unitId === null || ! isset($unitProperties[$part->unitId]))) {
                continue;
            }

            $bien = $part->propertyId ?? ($part->unitId === null ? null : ($unitProperties[$part->unitId] ?? null));
            $montant = (int) $part->ownerShare->getAmount();
            $semantique = $natures[$part->natureTermId] ?? null;
            $ligne = $semantique === null ? null : $formulaire->lineForCategory($semantique);

            if ($bien === null || $ligne === null) {
                $sortie[] = ['code' => 'unclassified_expense', 'property_id' => $bien, 'amount' => $montant, 'detail' => $part->invoiceId];

                continue;
            }

            $sortie[] = new FactEntryData($bien, $ligne, $montant, FactEntryData::SUPPLIER_INVOICE, $part->invoiceId);
        }

        return $sortie;
    }

    /**
     * Ligne 230 proposée : provisions déduites l'année précédente moins les charges réelles non récupérables du relevé du syndic de cette
     * année-là, par bien ayant un relevé. Une proposition à valider, jamais un montant décidé.
     *
     * @return list<FactEntryData>
     */
    private function coOwnershipRegularization(YearWindow $annee, Currency $devise, FormDefinition $formulaire, ?string $mandantId): array
    {
        $precedente = $annee->previous();
        $releves = $this->faits->coOwnershipStatements($precedente->from, $precedente->toExclusive);

        if ($releves === []) {
            return [];
        }

        $nets = $this->grandLivre->itemTotals(ItemType::Expense, $devise, $precedente->from, $precedente->last);
        $faits = $this->faits->byIds(array_keys($nets));
        $semantiques = $this->categories(array_values(array_unique(array_map(fn (ExpenseFactData $f): string => $f->categoryTermId, $faits))));
        $provisions = [];

        foreach ($nets as $id => $net) {
            $fait = $faits[$id] ?? null;

            if ($fait !== null && ($mandantId === null || $fait->mandantPartyId === $mandantId) && $fait->kind === ExpenseKind::Payment->value && ($semantiques[$fait->categoryTermId] ?? null) === ExpenseCategorySemantic::CoOwnership->value) {
                $provisions[$fait->propertyId] = ($provisions[$fait->propertyId] ?? 0) + (int) $net->getAmount();
            }
        }

        $reelles = [];
        $refs = [];

        foreach ($releves as $releve) {
            if ($mandantId !== null && $releve->mandantPartyId !== $mandantId) {
                continue;
            }

            $reelles[$releve->propertyId] = ($reelles[$releve->propertyId] ?? 0) + (int) $releve->gross->subtract($releve->recoverable)->getAmount();
            $refs[$releve->propertyId] ??= $releve->id;
        }

        $entrees = [];

        foreach ($reelles as $bien => $reel) {
            $entrees[] = new FactEntryData($bien, '230', ($provisions[$bien] ?? 0) - $reel, FactEntryData::CO_OWNERSHIP_STATEMENT, $refs[$bien]);
        }

        return $entrees;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string> sens de catégorie par valeur ; une valeur sans sens est absente
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
            $semantique = $this->expenseSemantic($terme);

            if ($semantique !== null) {
                $sens[$id] = $semantique;
            }
        }

        return $sens;
    }

    private function expenseSemantic(TermData $terme): ?string
    {
        $valeur = $terme->metadata['expense_semantic'] ?? null;

        return is_string($valeur) && $valeur !== '' ? $valeur : null;
    }
}
