<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Data\ChargeAnomalyData;
use App\Modules\Charges\Queries\ChargeOrganizations;
use App\Modules\Charges\Support\AnomalyChecks;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Log;

/**
 * Signale sans corriger : une anomalie est journalisée et auditée, jamais réparée automatiquement.
 */
final readonly class VerifyCharges
{
    public function __construct(
        private CurrentOrganization $contexte,
        private ChargeOrganizations $organisations,
        private AnomalyChecks $controles,
        private RecordAudit $audit,
    ) {}

    /**
     * @return list<ChargeAnomalyData>
     */
    public function handle(): array
    {
        $trouvees = [];

        foreach ($this->organisations->withActivity() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, &$trouvees): void {
                foreach ($this->controles->of($organisation) as $anomalie) {
                    Log::critical('Anomalie de charges', ['kind' => $anomalie->kind->value, 'organization_id' => $organisation, 'subject_id' => $anomalie->subjectId, 'detail' => $anomalie->detail]);
                    $this->audit->handle('charges.anomaly.detected', metadata: ['kind' => $anomalie->kind->value, 'subject_id' => $anomalie->subjectId, 'detail' => $anomalie->detail]);
                    $trouvees[] = $anomalie;
                }
            });
        }

        return $trouvees;
    }
}
