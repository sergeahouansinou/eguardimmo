<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Carbon\CarbonImmutable;

/**
 * Loyers appelés et encaissés d'un mois, lus sur le compte locataire (valable pour une agence comme pour un bailleur autonome).
 */
final readonly class RentKpis
{
    public function __construct(private LedgerAggregates $grandLivre, private OrganizationDirectory $organisations) {}

    /**
     * @return array{currency: string, rent_called: array{amount: int, currency: string}, rent_collected: array{amount: int, currency: string}, collection_rate_basis_points: int|null}
     */
    public function of(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $devise = $this->organisations->currency();
        $appele = 0;
        $encaisse = 0;

        foreach ($this->grandLivre->movements([AccountRole::TenantReceivable], $devise, $from, $to, null, null, [SourceType::Installment, SourceType::Payment]) as $m) {
            $net = (int) $m->debit->getAmount() - (int) $m->credit->getAmount();

            if ($m->source === SourceType::Installment) {
                $appele += $net;
            } else {
                $encaisse -= $net;
            }
        }

        return [
            'currency' => $devise->getCode(),
            'rent_called' => ['amount' => $appele, 'currency' => $devise->getCode()],
            'rent_collected' => ['amount' => $encaisse, 'currency' => $devise->getCode()],
            'collection_rate_basis_points' => $appele > 0 ? intdiv($encaisse * 10000, $appele) : null,
        ];
    }
}
