<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Rent\PublicApi\OwnerBackfill;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Log;

/**
 * Signale, par organisation, les échéances émises sous mandat qui ne sont pas routées vers les fonds du mandant. Ne corrige rien.
 */
final readonly class ReconcileOwnerFunds
{
    public function __construct(
        private CurrentOrganization $contexte,
        private LedgerAggregates $agregats,
        private OwnerBackfill $rattrapage,
        private RecordAudit $audit,
    ) {}

    /**
     * @return array<string, int> nombre d'échéances non routées, par organisation
     */
    public function handle(): array
    {
        $anomalies = [];

        foreach ($this->agregats->organizationsWithOwnerFunds() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, &$anomalies): void {
                $nombre = count($this->rattrapage->plan()->items);

                if ($nombre === 0) {
                    return;
                }

                $anomalies[$organisation] = $nombre;
                Log::warning('Échéances sous mandat non routées', ['organization_id' => $organisation, 'installments' => $nombre]);
                $this->audit->handle('ownerfunds.verify.anomaly', metadata: ['kind' => 'unrouted_installments', 'installments' => $nombre]);
            });
        }

        return $anomalies;
    }
}
