<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\ReceiptState;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Throwable;

final readonly class IssueSettledReceipts
{
    public function __construct(private IssueReceipt $quittances) {}

    /**
     * Émission automatique après la transaction d'argent : une panne du PDF ne défait jamais un encaissement. Elle est
     * rapportée, la quittance reste « en attente » et se reprend par `POST /rent/receipts/issue-pending`.
     *
     * @param  list<Installment>  $echeances  échéances soldées
     * @return array<string, ReceiptState> sort de la quittance par échéance
     */
    public function handle(array $echeances, CarbonImmutable $today): array
    {
        $sorts = [];

        foreach ($echeances as $echeance) {
            try {
                $quittance = $this->quittances->handle($echeance, $today, automatique: true);
                $sorts[$echeance->id] = $quittance === null ? ReceiptState::OnDemand : ReceiptState::Issued;
            } catch (Throwable $erreur) {
                report($erreur);
                $sorts[$echeance->id] = ReceiptState::Pending;
            }
        }

        return $sorts;
    }
}
