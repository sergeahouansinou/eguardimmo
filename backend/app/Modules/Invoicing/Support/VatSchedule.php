<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\Models\Invoice;
use Money\Money;

/**
 * TVA exigible à l'encaissement : tant qu'une facture a un reste dû, la TVA encore différée vaut le prorata
 * TVA × reste dû ÷ TTC (arrondi au demi supérieur) ; le dernier règlement la solde, l'arrondi compris. La TVA différée
 * se lit au grand livre (comptes `VatDeferred` référençant la facture).
 */
final readonly class VatSchedule
{
    public function __construct(private LedgerReader $livre) {}

    /**
     * TVA à faire passer de `VatDeferred` vers `VatCollected` pour ce règlement.
     */
    public function transferOnPayment(Invoice $facture, int $reglement, int $resteAvant, int $avoirsTtc, int $avoirsTva): int
    {
        $differee = $this->deferred($facture);

        if ($differee === 0) {
            return 0;
        }

        $cible = $this->target($facture->currency, (int) $facture->total_tax->getAmount() - $avoirsTva, (int) $facture->total_gross->getAmount() - $avoirsTtc, $resteAvant - $reglement);

        return $differee - min($differee, $cible);
    }

    /**
     * TVA différée libérée par un avoir (le reste de la TVA de l'avoir vient en diminution de la TVA collectée).
     */
    public function releaseOnCredit(Invoice $facture, int $avoirTtc, int $avoirTva, int $resteAvant, int $avoirsTtc, int $avoirsTva): int
    {
        $differee = $this->deferred($facture);

        if ($differee === 0) {
            return 0;
        }

        $cible = $this->target(
            $facture->currency,
            (int) $facture->total_tax->getAmount() - $avoirsTva - $avoirTva,
            (int) $facture->total_gross->getAmount() - $avoirsTtc - $avoirTtc,
            $resteAvant - $avoirTtc,
        );

        return $differee - min($differee, $cible);
    }

    private function deferred(Invoice $facture): int
    {
        return (int) $this->livre->deferredVat(ItemType::Invoice, $facture->id, Currencies::of($facture->currency))->getAmount();
    }

    private function target(string $devise, int $tva, int $ttc, int $reste): int
    {
        if ($ttc <= 0 || $reste <= 0 || $tva <= 0) {
            return 0;
        }

        return (int) (new Money($tva, Currencies::of($devise)))->multiply($reste)->divide($ttc)->getAmount();
    }
}
