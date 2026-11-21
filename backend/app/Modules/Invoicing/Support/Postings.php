<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Modules\Invoicing\Models\Invoice;
use Carbon\CarbonImmutable;
use Money\Currency;
use Money\Money;

/**
 * Écritures du journal `fees` (ADR 0028). La créance suit le bail quand la facture vise une partie à ce bail
 * (`TenantReceivable`, visible au solde du bail et dans Recovery), sinon le compte « Clients ».
 */
final class Postings
{
    public function issue(Invoice $facture, PricedInvoice $chiffree, bool $recipientOnLease, bool $vatDeferred): EntryData
    {
        $devise = Currencies::of($chiffree->currency);
        $role = self::receivable($facture, $recipientOnLease);
        $lignes = [LineData::debit($role, new Money($chiffree->gross(), $devise), $facture->lease_id, $facture->recipient_party_id, null, ItemType::Invoice, $facture->id)];

        foreach ($this->revenues($chiffree, $devise) as $compte => $montant) {
            $lignes[] = LineData::credit(AccountRole::from($compte), $montant, $facture->lease_id, $facture->recipient_party_id);
        }

        if ($chiffree->tax > 0) {
            $tva = new Money($chiffree->tax, $devise);
            $lignes[] = $vatDeferred
                ? LineData::credit(AccountRole::VatDeferred, $tva, $facture->lease_id, $facture->recipient_party_id, null, ItemType::Invoice, $facture->id)
                : LineData::credit(AccountRole::VatCollected, $tva, $facture->lease_id, $facture->recipient_party_id);
        }

        return new EntryData(Journal::Fees, CarbonImmutable::parse((string) $facture->issued_on), "Facture {$facture->number}", SourceType::Invoice, $facture->id, "invoice:{$facture->id}:issue", $lignes);
    }

    /**
     * Écriture miroir : la créance est créditée avec l'identifiant de la facture d'origine, ce qui fait baisser son reste dû.
     * La part déjà réglée par compensation (`$recreditProprietaire`) est recréditée au compte du mandant.
     */
    public function creditNote(Invoice $avoir, Invoice $origine, PricedInvoice $chiffree, int $tvaLiberee, int $recreditProprietaire = 0): EntryData
    {
        $devise = Currencies::of($chiffree->currency);
        $role = self::receivableOf($origine);
        $lignes = [];

        foreach ($this->revenues($chiffree, $devise) as $compte => $montant) {
            $lignes[] = LineData::debit(AccountRole::from($compte), $montant, $origine->lease_id, $origine->recipient_party_id);
        }

        if ($tvaLiberee > 0) {
            $lignes[] = LineData::debit(AccountRole::VatDeferred, new Money($tvaLiberee, $devise), $origine->lease_id, $origine->recipient_party_id, null, ItemType::Invoice, $origine->id);
        }

        $reste = $chiffree->tax - $tvaLiberee;

        if ($reste > 0) {
            $lignes[] = LineData::debit(AccountRole::VatCollected, new Money($reste, $devise), $origine->lease_id, $origine->recipient_party_id);
        } elseif ($reste < 0) {
            $lignes[] = LineData::credit(AccountRole::VatCollected, new Money(-$reste, $devise), $origine->lease_id, $origine->recipient_party_id);
        }

        $creance = $chiffree->gross() - $recreditProprietaire;
        $lignes[] = LineData::credit($role, new Money($creance, $devise), $origine->lease_id, $origine->recipient_party_id, null, ItemType::Invoice, $origine->id);

        if ($recreditProprietaire > 0) {
            $lignes[] = LineData::credit(AccountRole::OwnerPayable, new Money($recreditProprietaire, $devise), null, $origine->recipient_party_id);
        }

        return new EntryData(Journal::Fees, CarbonImmutable::parse((string) $avoir->issued_on), "Avoir {$avoir->number} sur la facture {$origine->number}", SourceType::CreditNote, $avoir->id, "credit_note:{$avoir->id}:issue", $lignes);
    }

    public function payment(Invoice $facture, string $paymentId, int $montant, PaymentMethod $moyen, string $paidOn, int $tvaExigible, OnClosedPeriod $surPeriodeClose = OnClosedPeriod::Refuse): EntryData
    {
        $devise = Currencies::of($facture->currency);
        $somme = new Money($montant, $devise);
        $debit = match ($moyen) {
            PaymentMethod::OwnerAccount => LineData::debit(AccountRole::OwnerPayable, $somme, null, $facture->recipient_party_id),
            PaymentMethod::Cash => LineData::debit(AccountRole::Cash, $somme, $facture->lease_id, $facture->recipient_party_id),
            default => LineData::debit(AccountRole::Bank, $somme, $facture->lease_id, $facture->recipient_party_id),
        };
        $lignes = [
            $debit,
            LineData::credit(self::receivableOf($facture), $somme, $facture->lease_id, $facture->recipient_party_id, null, ItemType::Invoice, $facture->id),
        ];

        if ($tvaExigible > 0) {
            $tva = new Money($tvaExigible, $devise);
            $lignes[] = LineData::debit(AccountRole::VatDeferred, $tva, $facture->lease_id, $facture->recipient_party_id, null, ItemType::Invoice, $facture->id);
            $lignes[] = LineData::credit(AccountRole::VatCollected, $tva, $facture->lease_id, $facture->recipient_party_id);
        }

        return new EntryData(Journal::Fees, CarbonImmutable::parse($paidOn), "Règlement de la facture {$facture->number}", SourceType::Payment, $paymentId, "invoice:{$facture->id}:payment:{$paymentId}", $lignes, $surPeriodeClose);
    }

    public static function receivable(Invoice $facture, bool $recipientOnLease): AccountRole
    {
        return $facture->lease_id !== null && $recipientOnLease ? AccountRole::TenantReceivable : AccountRole::CustomerReceivable;
    }

    /**
     * Le compte retenu à l'émission est figé dans l'instantané : un règlement ou un avoir ne le redécide jamais.
     */
    public static function receivableOf(Invoice $facture): AccountRole
    {
        $role = is_array($facture->snapshot['ledger'] ?? null) ? ($facture->snapshot['ledger']['receivable_account'] ?? null) : null;

        return AccountRole::tryFrom((string) $role) ?? AccountRole::CustomerReceivable;
    }

    /**
     * @return array<string, Money> produit par compte, dans l'ordre des lignes
     */
    private function revenues(PricedInvoice $chiffree, Currency $devise): array
    {
        $comptes = [];

        foreach ($chiffree->lines as $ligne) {
            $role = ItemAccounts::revenue($ligne->line->semantic)->value;
            $comptes[$role] = ($comptes[$role] ?? 0) + $ligne->net;
        }

        return array_map(fn (int $montant): Money => new Money($montant, $devise), array_filter($comptes, fn (int $montant): bool => $montant > 0));
    }
}
