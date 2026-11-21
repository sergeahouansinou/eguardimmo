<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Charges\Data\ExpenseInputData;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonImmutable;

/**
 * Règles de saisie d'une dépense (ADR 0034 § 3) : tout se vérifie côté serveur, la devise et le mandant ne viennent jamais du client.
 */
final readonly class ExpenseRules
{
    public function __construct(
        private Operators $operateurs,
        private UnitDirectory $lots,
        private TermDirectory $termes,
        private PartyDirectory $parties,
        private MandateDirectory $mandats,
        private OrganizationDirectory $organisation,
        private ChargeRulesRegistry $juridictions,
    ) {}

    public function resolve(ExpenseInputData $d, CarbonImmutable $today): ResolvedExpense
    {
        $autonome = $this->operateurs->isIndividualOrganization();

        if ($autonome && $d->settlement->agencyOnly()) {
            throw ErrorCode::AgencyOnly->problem('Ce mode de règlement n\'existe que pour une agence : un bailleur autonome comptabilise toujours la dépense.');
        }

        $this->assertSettlement($d, $autonome);
        $this->assertDates($d, $today);
        $categorie = $this->termes->findAssignable($d->categoryTermId, VocabularyKey::ExpenseCategory);
        $this->assertAmounts($d, $categorie->semanticKey);
        $lots = $this->lots->ofProperty($d->propertyId);

        if ($d->unitId !== null && ! in_array($d->unitId, array_map(fn (UnitData $l): string => $l->id, $lots), true)) {
            throw ErrorCode::ExpenseInvalid->problem('Le lot n\'appartient pas à ce bien.');
        }

        if ($d->payeePartyId !== null) {
            $this->parties->find($d->payeePartyId);
        }

        [$mandat, $mandant] = $d->settlement->agencyOnly() ? $this->mandant($d, $lots) : [null, null];

        return new ResolvedExpense($this->organisation->currency()->getCode(), $categorie->key, $mandat, $mandant);
    }

    private function assertSettlement(ExpenseInputData $d, bool $autonome): void
    {
        if ($d->kind === ExpenseKind::CoOwnershipStatement && ($d->settlement !== ExpenseSettlement::None || $d->unitId === null)) {
            throw ErrorCode::ExpenseSettlementInvalid->problem('Un relevé du syndic se saisit pour un lot, sans mode de règlement.');
        }

        if ($d->kind === ExpenseKind::Payment && $d->settlement === ExpenseSettlement::None) {
            throw ErrorCode::ExpenseSettlementInvalid->problem('Une dépense payée porte un mode de règlement.');
        }

        if (! $autonome && in_array($d->settlement, [ExpenseSettlement::Bank, ExpenseSettlement::Cash], true)) {
            throw ErrorCode::ExpenseSettlementInvalid->problem('Une agence règle sur les fonds du mandant, par avance ou payée par le mandant.');
        }

        if (($d->payeePartyId === null) === ($d->payeeLabel === null || trim($d->payeeLabel) === '')) {
            throw ErrorCode::ExpenseInvalid->problem('Indiquez le bénéficiaire : une partie ou un libellé.');
        }

        if ($d->document === null && ($d->recoverableAmount > 0 || $d->settlement->needsDocument())) {
            throw ErrorCode::ExpenseInvalid->problem('Une pièce justificative est obligatoire.');
        }
    }

    private function assertDates(ExpenseInputData $d, CarbonImmutable $today): void
    {
        $jour = $today->toDateString();

        if ($d->serviceTo <= $d->serviceFrom || $d->documentOn > $jour || ($d->paidOn !== null && ($d->paidOn > $jour || $d->paidOn < $d->documentOn))) {
            throw ErrorCode::ExpenseInvalid->problem('Les dates de la pièce, du service ou du paiement sont incohérentes.');
        }
    }

    private function assertAmounts(ExpenseInputData $d, ?string $categorie): void
    {
        if ($d->totalGross <= 0 || $d->taxAmount > $d->totalGross || $d->recoverableAmount > $d->totalGross) {
            throw ErrorCode::ExpenseInvalid->problem('Les montants sont incohérents.');
        }

        if ($d->kind === ExpenseKind::CoOwnershipStatement && $categorie !== ExpenseCategorySemantic::CoOwnership->value) {
            throw ErrorCode::ExpenseInvalid->problem('Un relevé du syndic relève de la catégorie des charges de copropriété.');
        }

        if ($d->recoverableAmount === 0) {
            if ($d->recoverableRubric !== null) {
                throw ErrorCode::ExpenseInvalid->problem('Aucune rubrique sans part récupérable.');
            }

            return;
        }

        if ($d->kind === ExpenseKind::Payment && $categorie === ExpenseCategorySemantic::CoOwnership->value) {
            throw ErrorCode::ExpenseInvalid->problem('Un appel de fonds du syndic n\'est jamais récupérable : seul le relevé annuel l\'est.');
        }

        $regles = $this->juridictions->for($this->organisation->country());

        if (in_array($categorie, $regles->nonRecoverableCategories(), true)) {
            throw ErrorCode::ExpenseInvalid->problem('Cette catégorie n\'est pas récupérable sur le locataire.');
        }

        if ($d->recoverableRubric === null || ! in_array($d->recoverableRubric, $regles->recoverableRubrics(), true)) {
            throw ErrorCode::ExpenseInvalid->problem('Choisissez la rubrique récupérable de la liste.');
        }
    }

    /**
     * @param  list<UnitData>  $lots
     * @return array{string, string}
     */
    private function mandant(ExpenseInputData $d, array $lots): array
    {
        $ids = $d->unitId !== null ? [$d->unitId] : array_map(fn (UnitData $l): string => $l->id, $lots);
        $couverts = $this->mandats->coveringUnits($ids, CarbonImmutable::parse($d->documentOn));
        $mandants = array_values(array_unique(array_map(fn ($c): string => $c->mandantPartyId, $couverts)));

        if (count($mandants) > 1) {
            throw ErrorCode::ExpenseSplitRequired->problem('Les lots de ce bien relèvent de plusieurs mandants : saisissez une pièce par mandant.');
        }

        if ($mandants === []) {
            throw ErrorCode::ExpenseSettlementInvalid->problem('Aucun mandat ne couvre ce bien à la date de la pièce.');
        }

        $premier = array_values($couverts)[0];

        return [$premier->mandateId, $premier->mandantPartyId];
    }
}
