<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Support\CaseItems;
use App\Modules\Recovery\Support\CaseLock;
use App\Modules\Recovery\Support\Debtors;
use App\Modules\Recovery\Support\Receivables;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AddCaseItems
{
    public function __construct(
        private CaseLock $verrou,
        private Debtors $debiteurs,
        private Receivables $creances,
        private CaseItems $lignes,
        private RecordAudit $audit,
    ) {}

    /**
     * Rejouable : une créance déjà ouverte dans ce dossier est ignorée ; une créance d'un autre dossier actif est refusée.
     *
     * @param  list<string>  $installmentIds
     * @param  list<string>  $invoiceIds
     */
    public function handle(RecoveryCase $case, array $installmentIds, CarbonImmutable $today, array $invoiceIds = []): RecoveryCase
    {
        return DB::transaction(function () use ($case, $installmentIds, $invoiceIds, $today): RecoveryCase {
            $this->verrou->acquire();
            $dossier = RecoveryCase::query()->whereKey($case->id)->lockForUpdate()->firstOrFail();

            if (! $dossier->status->isActive()) {
                throw ErrorCode::CaseNotActive->problem();
            }

            $deja = $dossier->activeItems()->pluck('item_id')->all();
            $echeances = array_values(array_diff(array_unique($installmentIds), $deja));
            $factures = array_values(array_diff(array_unique($invoiceIds), $deja));

            if ($echeances === [] && $factures === []) {
                return $dossier;
            }

            $creances = $this->creances->collectible($dossier->lease_id, $echeances, $factures, $today);
            $this->debiteurs->assertReceivablesOf($dossier->lease_id, $dossier->debtor_party_id, $creances);
            $this->lignes->include($dossier, $creances);

            $this->audit->handle('recovery.case.items_added', subject: $dossier, metadata: ['items' => [...$echeances, ...$factures]]);

            return $dossier;
        });
    }
}
