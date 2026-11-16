<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Data\OwnershipAnomalyData;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\OwnershipAnomalies;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Log;

final readonly class VerifyOwnerships
{
    public function __construct(
        private OwnershipAnomalies $anomalies,
        private RecordAudit $audit,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * @return list<OwnershipAnomalyData>
     */
    public function handle(): array
    {
        $trouvees = $this->anomalies->find();

        foreach ($trouvees as $anomalie) {
            Log::critical('Anomalie des quotes-parts de propriété', [
                'kind' => $anomalie->kind->value,
                'organization_id' => $anomalie->organizationId,
                'unit_id' => $anomalie->unitId,
                'detail' => $anomalie->detail,
            ]);

            $this->contexte->run($anomalie->organizationId, fn () => $this->audit->handle(
                'properties.ownership.anomaly_detected',
                metadata: ['kind' => $anomalie->kind->value, 'detail' => $anomalie->detail],
                subject: Unit::query()->find($anomalie->unitId),
            ));
        }

        return $trouvees;
    }
}
