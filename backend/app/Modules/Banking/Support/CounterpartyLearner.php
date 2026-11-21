<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Models\BankCounterpartyLink;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Modules\Rent\PublicApi\RentLedger;
use Carbon\CarbonImmutable;

/**
 * Chaque validation nourrit `bank_counterparty_links` : l'empreinte de contrepartie de la ligne est liée à la partie réglée.
 */
final readonly class CounterpartyLearner
{
    public function __construct(private RentLedger $loyers, private InvoiceLedger $factures) {}

    /**
     * À appeler avant le règlement : une échéance ou une facture soldée n'est plus lisible parmi les restes dus.
     *
     * @param  list<array{id: string, amount: int}>  $cibles
     */
    public function learn(BankStatementLine $ligne, SuggestionAction $action, array $cibles): void
    {
        if ($ligne->counterparty_hash === null || $ligne->direction !== Direction::Credit || $cibles === []) {
            return;
        }

        $asOf = CarbonImmutable::parse($ligne->booking_date->toDateString())->addDays(45);
        $parties = [];

        foreach ($cibles as $cible) {
            if ($action === SuggestionAction::SettleLease) {
                foreach ($this->loyers->unpaidInstallments($asOf, $cible['id'], null, 1) as $echeance) {
                    if ($echeance->partyId !== null) {
                        $parties[$echeance->partyId] = true;
                    }
                }
            } elseif ($action === SuggestionAction::SettleInvoice) {
                $apres = null;
                $trouve = false;

                for ($page = 0; $page < 20 && ! $trouve; $page++) {
                    $lot = $this->factures->unpaidByLease($asOf, null, $apres, 500);

                    foreach ($lot as $facture) {
                        if ($facture->invoiceId === $cible['id']) {
                            $parties[$facture->partyId] = true;
                            $trouve = true;
                        }
                    }

                    if (count($lot) < 500) {
                        break;
                    }

                    $apres = $lot[count($lot) - 1]->invoiceId;
                }
            }
        }

        foreach (array_keys($parties) as $partieId) {
            $lien = BankCounterpartyLink::query()->firstOrCreate(
                ['counterparty_hash' => $ligne->counterparty_hash, 'party_id' => $partieId],
                ['origin' => 'confirmed', 'confirmations' => 0],
            );
            $lien->forceFill(['confirmations' => $lien->confirmations + 1, 'last_confirmed_at' => now()])->save();
        }
    }
}
