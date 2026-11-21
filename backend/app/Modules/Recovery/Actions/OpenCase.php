<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Recovery\Data\OpenCaseData;
use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Enums\SequenceKind;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Support\CaseItems;
use App\Modules\Recovery\Support\CaseLock;
use App\Modules\Recovery\Support\Debtors;
use App\Modules\Recovery\Support\Numbers;
use App\Modules\Recovery\Support\Receivables;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class OpenCase
{
    public function __construct(
        private CaseLock $verrou,
        private LeaseDirectory $baux,
        private Debtors $debiteurs,
        private Receivables $creances,
        private CaseItems $lignes,
        private Numbers $numeros,
        private RecordAudit $audit,
    ) {}

    /**
     * Ouvre le dossier d'un bail et d'un débiteur avec les créances choisies. Les montants viennent du grand livre
     * (via Rent), jamais du client. Sous le verrou de l'organisation : un seul dossier actif par bail et débiteur, une
     * créance dans un seul dossier actif.
     */
    public function handle(OpenCaseData $data, CarbonImmutable $today): RecoveryCase
    {
        return DB::transaction(function () use ($data, $today): RecoveryCase {
            $this->verrou->acquire();
            $bail = $this->baux->find($data->leaseId);
            $this->debiteurs->assertTenantOf($bail->id, $data->debtorPartyId);

            $existe = RecoveryCase::query()
                ->where('lease_id', $bail->id)
                ->where('debtor_party_id', $data->debtorPartyId)
                ->whereIn('status', array_map(fn (CaseStatus $s): string => $s->value, CaseStatus::active()))
                ->exists();

            if ($existe) {
                throw ErrorCode::CaseExists->problem();
            }

            $creances = $this->creances->collectible($bail->id, $data->installmentIds, $data->invoiceIds, $today);
            $this->debiteurs->assertReceivablesOf($bail->id, $data->debtorPartyId, $creances);

            $dossier = RecoveryCase::query()->create([
                'number' => $this->numeros->next(SequenceKind::CaseFile, $today),
                'lease_id' => $bail->id,
                'debtor_party_id' => $data->debtorPartyId,
                'status' => CaseStatus::Open,
                'currency' => $bail->currency,
                'opened_on' => Carbon::instance($today),
                'opened_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);
            $this->lignes->include($dossier, $creances);

            $this->audit->handle('recovery.case.opened', subject: $dossier, metadata: ['number' => $dossier->number, 'items' => count($creances)]);

            return $dossier;
        });
    }
}
