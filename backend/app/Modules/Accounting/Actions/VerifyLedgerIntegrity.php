<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Actions;

use App\Modules\Accounting\Data\LedgerAnomalyData;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Queries\LedgerAnomalies;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Log;

final readonly class VerifyLedgerIntegrity
{
    public function __construct(
        private LedgerAnomalies $anomalies,
        private RecordAudit $audit,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * @return list<LedgerAnomalyData>
     */
    public function handle(): array
    {
        $trouvees = $this->anomalies->find();

        foreach ($trouvees as $anomalie) {
            Log::critical('Anomalie du grand livre', [
                'kind' => $anomalie->kind->value,
                'organization_id' => $anomalie->organizationId,
                'entry_id' => $anomalie->entryId,
                'detail' => $anomalie->detail,
            ]);

            $this->contexte->run($anomalie->organizationId, fn () => $this->audit->handle(
                'accounting.ledger.anomaly_detected',
                metadata: ['kind' => $anomalie->kind->value, 'detail' => $anomalie->detail],
                subject: $anomalie->entryId === null ? null : JournalEntry::query()->find($anomalie->entryId),
            ));
        }

        return $trouvees;
    }
}
