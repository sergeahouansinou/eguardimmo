<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Enums\ReceiptState;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Support\InstallmentView;
use App\Modules\Rent\Support\Settlement;
use Carbon\CarbonImmutable;

final readonly class InstallmentViews
{
    public function __construct(
        private Settlement $reglement,
        private LeaseDirectory $baux,
    ) {}

    /**
     * Un nombre de requêtes qui ne dépend pas du nombre d'échéances : restes dus, baux et chèques par lot.
     * Les relations `notice` et `receipt` sont chargées par l'appelant.
     *
     * @param  list<Installment>  $echeances
     */
    public function of(array $echeances, CarbonImmutable $today): InstallmentView
    {
        $appelees = array_values(array_filter($echeances, fn (Installment $e): bool => $e->status->isOpen() || $e->status === InstallmentStatus::Paid));
        $baux = $echeances === [] ? [] : $this->baux->findMany(array_values(array_unique(array_map(fn (Installment $e): string => $e->lease_id, $echeances))));
        $parBail = [];

        foreach ($baux as $bail) {
            $parBail[$bail->id] = $bail;
        }

        $soldeesSansQuittance = array_values(array_filter($echeances, fn (Installment $e): bool => $e->status === InstallmentStatus::Paid && $e->receipt === null));
        $cheques = $soldeesSansQuittance === [] ? [] : array_flip(PaymentAllocation::query()
            ->whereIn('installment_id', array_map(fn (Installment $e): string => $e->id, $soldeesSansQuittance))
            ->whereNull('reversed_at')
            ->whereHas('payment', fn ($p) => $p->where('method', PaymentMethod::Cheque->value))
            ->pluck('installment_id')
            ->all());
        $etats = [];

        foreach ($echeances as $echeance) {
            $etats[$echeance->id] = match (true) {
                $echeance->status !== InstallmentStatus::Paid => ReceiptState::NotDue,
                $echeance->receipt !== null => ReceiptState::Issued,
                isset($cheques[$echeance->id]) => ReceiptState::OnDemand,
                default => ReceiptState::Pending,
            };
        }

        return new InstallmentView($this->reglement->outstanding($appelees), $parBail, $etats, $today);
    }
}
