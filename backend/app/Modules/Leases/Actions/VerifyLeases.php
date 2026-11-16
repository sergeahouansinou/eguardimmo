<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\LeaseAnomalyData;
use App\Modules\Leases\Queries\LeaseAnomalies;
use Illuminate\Support\Facades\Log;

final readonly class VerifyLeases
{
    public function __construct(private LeaseAnomalies $anomalies) {}

    /**
     * @return list<LeaseAnomalyData>
     */
    public function handle(): array
    {
        $trouvees = $this->anomalies->find();

        foreach ($trouvees as $anomalie) {
            Log::critical('Anomalie des baux', [
                'kind' => $anomalie->kind->value,
                'organization_id' => $anomalie->organizationId,
                'lease_id' => $anomalie->leaseId,
                'detail' => $anomalie->detail,
            ]);
        }

        return $trouvees;
    }
}
