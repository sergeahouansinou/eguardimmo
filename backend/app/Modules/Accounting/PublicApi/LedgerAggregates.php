<?php

declare(strict_types=1);

namespace App\Modules\Accounting\PublicApi;

use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\Data\AgingData;
use App\Modules\Accounting\Data\CollectionMovementData;
use App\Modules\Accounting\Data\ComponentCollectionData;
use App\Modules\Accounting\Data\MovementData;
use App\Modules\Accounting\Data\OwnerFundsBalanceData;
use App\Modules\Accounting\Data\PartyStatementData;
use App\Modules\Accounting\Data\TrustCoverageData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Queries\Aggregates;
use App\Modules\Accounting\Queries\Aging;
use App\Modules\Accounting\Queries\CollectedByComponent;
use App\Modules\Accounting\Queries\ItemTotals;
use App\Modules\Accounting\Queries\LeaseDues;
use App\Modules\Accounting\Queries\LedgerAnomalies;
use App\Modules\Accounting\Queries\Movements;
use App\Modules\Accounting\Queries\PartyStatements;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Money\Currency;
use Money\Money;

/**
 * Agrégats du grand livre de l'organisation courante pour la gestion des fonds de mandants (ADR 0031, 6).
 */
final readonly class LedgerAggregates
{
    public function __construct(
        private Aggregates $agregats,
        private Movements $mouvements,
        private PartyStatements $releves,
        private Aging $anciennete,
        private LeaseDues $dettesBaux,
        private LedgerAnomalies $anomalies,
        private ItemTotals $totauxParPiece,
        private CollectedByComponent $encaissements,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Soldes par mandant : `OwnerPayable`, `PayoutsInTransit` et appelés non encaissés ; un mandant inconnu vaut zéro.
     *
     * @param  list<string>  $partyIds
     * @return array<string, OwnerFundsBalanceData>
     */
    public function ownerFunds(array $partyIds, Currency $currency, ?CarbonImmutable $asOf = null): array
    {
        return $this->agregats->ownerFunds($partyIds, $currency, $asOf);
    }

    /**
     * Tous les mandants qui ont une écriture sur les comptes de fonds.
     *
     * @return array<string, OwnerFundsBalanceData>
     */
    public function allOwnerFunds(Currency $currency, ?CarbonImmutable $asOf = null): array
    {
        return $this->agregats->ownerFunds(null, $currency, $asOf);
    }

    /**
     * Encaissements imputés (net des contrepassations) par lot et par jour sur les comptes « appelés » donnés, entre deux dates comptables incluses.
     *
     * @param  list<AccountRole>  $roles
     * @return list<CollectionMovementData>
     */
    public function collections(array $roles, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->agregats->collections($roles, $currency, $from, $to);
    }

    /**
     * Totaux par compte, partie, lot, mois (Y-m) et type de source entre deux dates comptables incluses, en une requête.
     * Une contrepassation vient en déduction du type de source de l'écriture annulée. `null` : pas de filtre ; liste vide : aucun résultat.
     *
     * @param  list<AccountRole>  $roles
     * @param  list<string>|null  $partyIds
     * @param  list<string>|null  $unitIds
     * @param  list<SourceType>|null  $sources
     * @return list<MovementData>
     */
    public function movements(array $roles, Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $partyIds = null, ?array $unitIds = null, ?array $sources = null): array
    {
        return $this->mouvements->between($roles, $currency, $from, $to, $partyIds, $unitIds, $sources);
    }

    /**
     * Montant net débiteur par pièce d'un type (une dépense, par exemple) entre deux dates comptables incluses ; `null` : tous les lots,
     * liste vide : aucun résultat. Une contrepassation vient en déduction de sa pièce.
     *
     * @param  list<string>|null  $unitIds
     * @return array<string, Money> par identifiant de pièce
     */
    public function itemTotals(ItemType $type, Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $unitIds = null): array
    {
        return $this->totauxParPiece->between($type, $currency, $from, $to, $unitIds);
    }

    /**
     * Encaissements d'un bailleur autonome (paiements en banque ou en espèces, contrepassations déduites) ventilés loyer, charges, TVA
     * et avances par bail, lot et mois, entre deux dates comptables incluses. Part de chaque composant : celle de l'écriture d'appel de
     * l'échéance, au prorata, plus fort reste. Un encaissement sans appel lisible tombe dans `unresolved`, jamais dans le loyer.
     *
     * @param  list<string>|null  $unitIds  `null` : tous les lots ; une avance, sans lot au grand livre, est toujours renvoyée
     * @return list<ComponentCollectionData>
     */
    public function collectedByComponent(Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $unitIds = null): array
    {
        return $this->encaissements->between($currency, $from, $to, $unitIds);
    }

    /**
     * Relevé d'un compte pour une partie, plafonné à `Balances::RELEVE_LIGNES_MAX` lignes (422 `statement_too_long`).
     */
    public function partyStatement(string $partyId, AccountRole $role, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): PartyStatementData
    {
        return $this->releves->of($partyId, $role, $currency, $from, $to);
    }

    /**
     * Reste dû des créances ouvertes (locataires et clients) par ancienneté depuis leur date comptable : 0-30, 31-60, 61-90, plus de 90 jours.
     */
    public function outstandingAging(Currency $currency, CarbonImmutable $asOf): AgingData
    {
        return $this->anciennete->at($currency, $asOf);
    }

    /**
     * Reste dû de plusieurs baux (compte locataire, avances déduites) en une requête ; un bail sans écriture vaut zéro.
     *
     * @param  list<string>  $leaseIds
     * @return array<string, Money> par bail
     */
    public function dueByLeases(array $leaseIds, Currency $currency, ?CarbonImmutable $asOf = null): array
    {
        return $this->dettesBaux->of($leaseIds, $currency, $asOf);
    }

    public function trustCoverage(Currency $currency, ?CarbonImmutable $asOf = null): TrustCoverageData
    {
        return $this->agregats->trust($currency, $asOf);
    }

    /**
     * Premier jour encore ouvert ; null quand aucun mois n'est clos.
     */
    public function firstOpenDay(): ?CarbonImmutable
    {
        return $this->agregats->firstOpenDay();
    }

    public function closedThrough(): ?CarbonImmutable
    {
        return $this->firstOpenDay()?->subDay();
    }

    public function isClosed(CarbonImmutable $monthStart): bool
    {
        return $this->agregats->isClosed($monthStart);
    }

    /**
     * Jeton de version du grand livre, posé à la clôture d'un mois.
     */
    public function version(): string
    {
        return $this->agregats->version();
    }

    /**
     * @return list<string> organisations dont les fonds des mandants sont actifs
     */
    public function organizationsWithOwnerFunds(): array
    {
        return $this->agregats->organizationsWithOwnerFunds();
    }

    /**
     * @return list<AccountingPeriodData>
     */
    public function periods(): array
    {
        return $this->agregats->periods();
    }

    public function hasAnomalies(): bool
    {
        return $this->anomalies->find($this->contexte->id()) !== [];
    }
}
