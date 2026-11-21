<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Rent\Data\LeaseProvisionsData;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Enums\LineSemantic;
use App\Modules\Rent\Models\InstallmentLine;
use App\Modules\Rent\Support\Currencies;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\JoinClause;
use Money\Money;

/**
 * Provisions appelées par bail : lignes `charges_provision` des échéances émises et non annulées dont le mois tombe dans la période.
 * Le reste dû vient du grand livre, jamais d'un champ de l'échéance.
 */
final readonly class ProvisionTotals
{
    public function __construct(private LedgerReader $lecteur) {}

    /**
     * @param  list<string>  $leaseIds
     * @return array<string, LeaseProvisionsData> par bail ; un bail sans provision appelée est absent
     */
    public function calledBetween(array $leaseIds, CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        $leaseIds = array_values(array_unique($leaseIds));

        if ($leaseIds === []) {
            return [];
        }

        $lues = InstallmentLine::query()
            ->join('installments as i', fn (JoinClause $j) => $j->on('i.id', '=', 'installment_lines.installment_id')->on('i.organization_id', '=', 'installment_lines.organization_id'))
            ->whereIn('i.lease_id', $leaseIds)
            ->whereIn('i.status', [InstallmentStatus::Issued->value, InstallmentStatus::PartiallyPaid->value, InstallmentStatus::Paid->value])
            ->where('installment_lines.semantic', LineSemantic::ChargesProvision->value)
            ->where('installment_lines.from_date', '>=', $from->toDateString())
            ->where('installment_lines.from_date', '<', $toExclusive->toDateString())
            ->selectRaw('i.id as installment_id, i.lease_id as lease_id, i.currency as currency, i.mandate_id as mandate_id, i.mandant_party_id as mandant_party_id, sum(installment_lines.amount) as provisions')
            ->groupBy('i.id', 'i.lease_id', 'i.currency', 'i.mandate_id', 'i.mandant_party_id')
            ->toBase()->get();

        $parDevise = [];

        foreach ($lues as $ligne) {
            $parDevise[(string) $ligne->currency][] = (string) $ligne->installment_id;
        }

        $restes = [];

        foreach ($parDevise as $devise => $ids) {
            $restes += $this->lecteur->outstandingMany(ItemType::Installment, $ids, Currencies::of($devise));
        }

        $bilans = [];

        foreach ($lues as $ligne) {
            $devise = Currencies::of((string) $ligne->currency);
            $appele = new Money((int) $ligne->provisions, $devise);
            $reste = $restes[(string) $ligne->installment_id] ?? new Money(0, $devise);
            $impaye = $reste->isPositive() ? ($reste->lessThan($appele) ? $reste : $appele) : new Money(0, $devise);
            $bail = (string) $ligne->lease_id;

            $bilans[$bail] ??= ['called' => new Money(0, $devise), 'unpaid' => new Money(0, $devise), 'count' => 0, 'mandants' => [], 'mandates' => [], 'unrouted' => false];
            $bilans[$bail]['called'] = $bilans[$bail]['called']->add($appele);
            $bilans[$bail]['unpaid'] = $bilans[$bail]['unpaid']->add($impaye);
            $bilans[$bail]['count']++;

            if (is_string($ligne->mandant_party_id)) {
                $bilans[$bail]['mandants'][$ligne->mandant_party_id] = true;
                $bilans[$bail]['mandates'][(string) $ligne->mandate_id] = true;
            } else {
                $bilans[$bail]['unrouted'] = true;
            }
        }

        $resultat = [];

        foreach ($bilans as $bail => $b) {
            $resultat[$bail] = new LeaseProvisionsData($bail, $b['called'], $b['unpaid'], $b['count'], array_map('strval', array_keys($b['mandants'])), array_map('strval', array_keys($b['mandates'])), $b['unrouted']);
        }

        return $resultat;
    }
}
