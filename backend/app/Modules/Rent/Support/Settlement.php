<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Data\PostedEntryData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Pont entre les échéances et le grand livre : l'appel de loyer s'y écrit, le reste dû s'y lit. Rent ne stocke aucun solde.
 */
final readonly class Settlement
{
    public function __construct(
        private Ledger $livre,
        private LedgerReader $lecteur,
    ) {}

    /**
     * Échéances appelées et non soldées d'un bail, verrouillées dans l'ordre d'imputation : le plus ancien d'abord.
     *
     * @return list<Installment>
     */
    public function lockedOpen(string $leaseId): array
    {
        return array_values(Installment::query()
            ->where('lease_id', $leaseId)
            ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, InstallmentStatus::open()))
            ->orderBy('due_date')->orderBy('period_start')->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->all());
    }

    /**
     * @param  list<Installment>  $echeances
     * @return array<string, Money> reste dû au grand livre par échéance
     */
    public function outstanding(array $echeances): array
    {
        $parDevise = [];

        foreach ($echeances as $echeance) {
            $parDevise[$echeance->currency][] = $echeance->id;
        }

        $restes = [];

        foreach ($parDevise as $devise => $ids) {
            $restes += $this->lecteur->outstandingMany(ItemType::Installment, $ids, Currencies::of($devise));
        }

        return $restes;
    }

    /**
     * Ramène le statut d'une échéance appelée à ce que dit le grand livre.
     */
    public function sync(Installment $echeance, Money $reste): void
    {
        $statut = match (true) {
            ! $reste->isPositive() => InstallmentStatus::Paid,
            $reste->equals($echeance->total_amount) => InstallmentStatus::Issued,
            default => InstallmentStatus::PartiallyPaid,
        };

        if ($echeance->status !== $statut) {
            $echeance->status = $statut;
            $echeance->save();
        }
    }

    public function postIssue(Installment $echeance, string $reference, CarbonImmutable $date): PostedEntryData
    {
        $analytique = [$echeance->lease_id, $echeance->party_id, $echeance->unit_id];
        $lignes = [LineData::debit(AccountRole::TenantReceivable, $echeance->total_amount, ...$analytique, itemType: ItemType::Installment, itemId: $echeance->id)];
        $mandant = $echeance->mandant_party_id;
        $comptes = $mandant === null
            ? [[AccountRole::RentRevenue, $echeance->rent_amount], [AccountRole::ChargesRecovered, $echeance->charges_amount], [AccountRole::VatCollected, $echeance->vat_amount]]
            : [[AccountRole::OwnerRentCalled, $echeance->rent_amount], [AccountRole::OwnerChargesCalled, $echeance->charges_amount], [AccountRole::OwnerVatCalled, $echeance->vat_amount]];

        foreach ($comptes as [$compte, $montant]) {
            if ($montant->isPositive()) {
                $lignes[] = $mandant === null
                    ? LineData::credit($compte, $montant, ...$analytique)
                    : LineData::credit($compte, $montant, $echeance->lease_id, $mandant, $echeance->unit_id, ItemType::Installment, $echeance->id);
            }
        }

        return $this->livre->post(new EntryData(
            Journal::Rent,
            $date,
            sprintf('Appel de loyer %s du %s au %s', $reference, $echeance->period_start->format('d/m/Y'), $echeance->period_end->format('d/m/Y')),
            SourceType::Installment,
            $echeance->id,
            'rent:installment:'.$echeance->id,
            $lignes,
            OnClosedPeriod::RollForward,
        ));
    }

    /**
     * Ventilation d'une part encaissée sur une échéance appelée pour un mandant : les comptes « appelés » sont soldés
     * au prorata de leur reste (arrondi au demi supérieur, écart au dernier composant non nul, jamais au-delà d'un reste)
     * et le total devient une dette envers le mandant. Vide pour une échéance non routée.
     *
     * @return list<LineData>
     */
    public function collectLines(Installment $echeance, Money $montant): array
    {
        $mandant = $echeance->mandant_party_id;

        if ($mandant === null || ! $montant->isPositive()) {
            return [];
        }

        $devise = $montant->getCurrency();
        $restes = $this->lecteur->calledRemaining(ItemType::Installment, $echeance->id, $devise);
        $total = new Money(0, $devise);

        foreach ($restes as $reste) {
            $total = $reste->isPositive() ? $total->add($reste) : $total;
        }

        if (! $total->isPositive()) {
            return [];
        }

        $parts = $montant->greaterThanOrEqual($total) ? array_map(fn (Money $r): Money => $r->isPositive() ? $r : new Money(0, $devise), $restes) : $this->prorata($montant, $restes, $total);
        $lignes = [];
        $imputee = new Money(0, $devise);

        foreach ($parts as $role => $part) {
            if ($part->isPositive()) {
                $lignes[] = LineData::debit(AccountRole::from($role), $part, $echeance->lease_id, $mandant, $echeance->unit_id, ItemType::Installment, $echeance->id);
                $imputee = $imputee->add($part);
            }
        }

        $lignes[] = LineData::credit(AccountRole::OwnerPayable, $imputee, $echeance->lease_id, $mandant, $echeance->unit_id);

        return $lignes;
    }

    /**
     * @param  array<string, Money>  $restes
     * @return array<string, Money>
     */
    private function prorata(Money $montant, array $restes, Money $total): array
    {
        $devise = $montant->getCurrency();
        $parts = [];
        $reste = $montant;
        $actifs = array_keys(array_filter($restes, fn (Money $r): bool => $r->isPositive()));
        $dernier = end($actifs);

        foreach ($actifs as $role) {
            $part = $role === $dernier ? $reste : $montant->multiply($restes[$role]->getAmount())->divide($total->getAmount());
            $part = $part->greaterThan($restes[$role]) ? $restes[$role] : $part;
            $part = $part->greaterThan($reste) ? $reste : $part;
            $parts[$role] = $part;
            $reste = $reste->subtract($part);
        }

        return $parts + array_map(fn (): Money => new Money(0, $devise), $restes);
    }

    /**
     * Verrou du compte des mandants des échéances données, dans l'ordre des identifiants : à prendre avant toute
     * contrepassation qui réduit leur solde (ADR 0031, 7 bis).
     *
     * @param  list<Installment>  $echeances
     */
    public function lockOwners(array $echeances): void
    {
        $mandants = array_values(array_unique(array_filter(array_map(fn (Installment $e): ?string => $e->mandant_party_id, $echeances))));
        sort($mandants);

        foreach ($mandants as $mandant) {
            $this->livre->lockParty($mandant);
        }
    }

    /**
     * Reclasse une avance (crédit du compte locataire sans créance) sur une échéance : même compte, deux lignes, rien ne bouge au solde du bail.
     */
    public function postAdvanceApplication(Installment $echeance, string $paymentId, Money $montant, CarbonImmutable $date, string $cle): PostedEntryData
    {
        return $this->livre->post(new EntryData(
            Journal::Adjustments,
            $date,
            sprintf('Imputation de l\'avance sur l\'échéance du %s', $echeance->due_date->format('d/m/Y')),
            SourceType::Payment,
            $paymentId,
            $cle,
            [
                LineData::debit(AccountRole::TenantReceivable, $montant, $echeance->lease_id, $echeance->party_id, $echeance->unit_id),
                LineData::credit(AccountRole::TenantReceivable, $montant, $echeance->lease_id, $echeance->party_id, $echeance->unit_id, ItemType::Installment, $echeance->id),
                ...$this->collectLines($echeance, $montant),
            ],
            OnClosedPeriod::RollForward,
        ));
    }

    public function reverse(string $entryId, CarbonImmutable $date): PostedEntryData
    {
        return $this->livre->reverse($entryId, $date);
    }
}
