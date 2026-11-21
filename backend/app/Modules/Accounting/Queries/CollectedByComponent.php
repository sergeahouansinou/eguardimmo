<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\ComponentCollectionData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\CollectionComponent;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\JoinClause;
use Money\Currency;
use Money\Money;

/**
 * Encaissements d'un bailleur autonome ventilés loyer, charges et TVA (ADR 0039, 6). L'encaissement ne crédite que le compte locataire :
 * la part de chaque composant est celle de l'écriture d'appel de l'échéance, au prorata, plus fort reste, somme exacte. Une avance
 * (crédit sans échéance) compte entière à sa réception ; son imputation ultérieure sur une échéance n'est pas un encaissement.
 */
final class CollectedByComponent
{
    private const array ENCAISSEMENT = [AccountRole::Bank, AccountRole::Cash, AccountRole::TrustBank];

    private const array COMPOSANTS = [
        'rent_revenue' => CollectionComponent::Rent,
        'charges_recovered' => CollectionComponent::Charges,
        'vat_collected' => CollectionComponent::Vat,
    ];

    /**
     * @param  list<string>|null  $unitIds
     * @return list<ComponentCollectionData>
     */
    public function between(Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $unitIds): array
    {
        if ($unitIds === []) {
            return [];
        }

        $paiements = $this->paiements($currency, $from, $to, $unitIds);
        $appels = $this->appels($currency, array_values(array_unique(array_filter(array_column($paiements, 'item_id')))));
        $totaux = [];

        foreach ($paiements as $p) {
            $net = MoneyColumns::money($p['net'], $currency);

            if ($net->isZero()) {
                continue;
            }

            $parts = $p['item_id'] === null
                ? [CollectionComponent::Advance->value => $net]
                : $this->ventiler($net, $appels[$p['item_id']] ?? []);

            foreach ($parts as $composant => $montant) {
                $cle = implode('|', [$p['lease_id'] ?? '', $p['unit_id'] ?? '', $p['month'], $composant]);
                $totaux[$cle] = [$p['lease_id'], $p['unit_id'], $p['month'], $composant, ($totaux[$cle][4] ?? new Money(0, $currency))->add($montant)];
            }
        }

        ksort($totaux);

        return array_values(array_map(
            fn (array $t): ComponentCollectionData => new ComponentCollectionData($t[0], $t[1], $t[2], CollectionComponent::from($t[3]), $t[4]),
            array_filter($totaux, fn (array $t): bool => ! $t[4]->isZero()),
        ));
    }

    /**
     * @param  list<string>|null  $unitIds
     * @return list<array{lease_id: ?string, unit_id: ?string, month: string, item_id: ?string, net: int|string}>
     */
    private function paiements(Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $unitIds): array
    {
        $roles = array_map(fn (AccountRole $r): string => $r->value, self::ENCAISSEMENT);
        $requete = JournalLine::query()
            ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->join('accounts as a', fn (JoinClause $j) => $j->on('a.id', '=', 'journal_lines.account_id')->on('a.organization_id', '=', 'journal_lines.organization_id'))
            ->leftJoin('journal_entries as o', fn (JoinClause $j) => $j->on('o.id', '=', 'e.reversal_of_id')->on('o.organization_id', '=', 'e.organization_id'))
            ->where('a.role', AccountRole::TenantReceivable->value)
            ->where('journal_lines.currency', $currency->getCode())
            ->whereRaw('coalesce(o.source_type, e.source_type) = ?', [SourceType::Payment->value])
            ->where('e.entry_date', '>=', $from->format('Y-m-d'))
            ->where('e.entry_date', '<', $to->addDay()->format('Y-m-d'))
            ->whereRaw(
                'exists (select 1 from journal_lines bl join accounts ba on ba.id = bl.account_id and ba.organization_id = bl.organization_id'
                .' where bl.organization_id = journal_lines.organization_id and bl.journal_entry_id = coalesce(o.id, e.id) and bl.debit > 0 and ba.role in ('.implode(', ', array_fill(0, count($roles), '?')).'))',
                $roles,
            );

        if ($unitIds !== null) {
            $requete->where(fn ($q) => $q->whereIn('journal_lines.unit_id', $unitIds)->orWhereNull('journal_lines.unit_id'));
        }

        $lues = $requete
            ->selectRaw('journal_lines.lease_id as lease_id, journal_lines.unit_id as unit_id, substr(e.entry_date, 1, 7) as month, journal_lines.item_id as item_id, sum(journal_lines.credit) - sum(journal_lines.debit) as net')
            ->groupBy('journal_lines.lease_id', 'journal_lines.unit_id', 'journal_lines.item_id')
            ->groupByRaw('substr(e.entry_date, 1, 7)')
            ->orderBy('month')
            ->toBase()->get();

        return array_values(array_map(fn (object $l): array => [
            'lease_id' => is_string($l->lease_id) ? $l->lease_id : null,
            'unit_id' => is_string($l->unit_id) ? $l->unit_id : null,
            'month' => (string) $l->month,
            'item_id' => is_string($l->item_id) ? $l->item_id : null,
            'net' => is_int($l->net) || is_string($l->net) ? $l->net : 0,
        ], $lues->all()));
    }

    /**
     * @param  list<string>  $echeanceIds
     * @return array<string, array<string, numeric-string>> montant d'appel (entier en chaîne) par échéance puis par composant
     */
    private function appels(Currency $currency, array $echeanceIds): array
    {
        $appels = [];

        foreach (array_chunk($echeanceIds, 500) as $lot) {
            $lues = JournalLine::query()
                ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
                ->join('accounts as a', fn (JoinClause $j) => $j->on('a.id', '=', 'journal_lines.account_id')->on('a.organization_id', '=', 'journal_lines.organization_id'))
                ->where('e.source_type', SourceType::Installment->value)
                ->whereNull('e.reversal_of_id')
                ->whereIn('e.source_id', $lot)
                ->whereIn('a.role', array_keys(self::COMPOSANTS))
                ->where('journal_lines.currency', $currency->getCode())
                ->selectRaw('e.source_id as installment_id, a.role as role, sum(journal_lines.credit) - sum(journal_lines.debit) as amount')
                ->groupBy('e.source_id', 'a.role')
                ->toBase()->get();

            foreach ($lues as $l) {
                $appels[(string) $l->installment_id][self::COMPOSANTS[(string) $l->role]->value] = MoneyColumns::money($l->amount, $currency)->getAmount();
            }
        }

        return $appels;
    }

    /**
     * @param  array<string, numeric-string>  $appel
     * @return array<string, Money>
     */
    private function ventiler(Money $net, array $appel): array
    {
        $devise = $net->getCurrency();
        $total = '0';

        foreach ($appel as $montant) {
            $total = bcadd($total, $montant, 0);
        }

        if (bccomp($total, '0', 0) <= 0) {
            return [CollectionComponent::Unresolved->value => $net];
        }

        $signe = $net->isNegative() ? -1 : 1;
        $abs = $net->absolute()->getAmount();
        $ordre = [CollectionComponent::Rent->value, CollectionComponent::Charges->value, CollectionComponent::Vat->value];
        $parts = [];
        $restes = [];
        $affecte = '0';

        foreach ($ordre as $composant) {
            $produit = bcmul($abs, $appel[$composant] ?? '0', 0);
            $parts[$composant] = bcdiv($produit, $total, 0);
            $restes[$composant] = bcmod($produit, $total, 0);
            $affecte = bcadd($affecte, $parts[$composant], 0);
        }

        $manque = (int) bcsub($abs, $affecte, 0);
        $classement = $ordre;
        usort($classement, fn (string $a, string $b): int => bccomp($restes[$b], $restes[$a], 0) ?: array_search($a, $ordre, true) <=> array_search($b, $ordre, true));

        for ($i = 0; $i < $manque; $i++) {
            $parts[$classement[$i % count($classement)]] = bcadd($parts[$classement[$i % count($classement)]], '1', 0);
        }

        $sortie = [];

        foreach ($parts as $composant => $part) {
            if (bccomp($part, '0', 0) > 0) {
                $sortie[$composant] = new Money($signe < 0 ? bcmul($part, '-1', 0) : $part, $devise);
            }
        }

        return $sortie;
    }
}
