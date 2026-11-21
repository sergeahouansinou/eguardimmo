<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Support\ItemClaims;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class ChangeCaseStatus
{
    public function __construct(
        private ItemClaims $revendications,
        private RevokeTransmission $revocation,
        private RecordAudit $audit,
    ) {}

    /**
     * `open` et `in_plan` s'échangent ; `closed` et `uncollectible` sont définitifs : les créances redeviennent libres et les
     * liens encore actifs sont révoqués (acte `revocation` par lien), dans la même transaction.
     */
    public function handle(RecoveryCase $case, CaseStatus $to, ?string $reason, CarbonImmutable $today): RecoveryCase
    {
        return DB::transaction(function () use ($case, $to, $reason, $today): RecoveryCase {
            $dossier = RecoveryCase::query()->whereKey($case->id)->lockForUpdate()->firstOrFail();

            if (! in_array($to, $dossier->status->transitions(), true)) {
                throw ErrorCode::StatusTransitionInvalid->problem();
            }

            $avant = $dossier->status;
            $dossier->status = $to;
            $dossier->status_reason = $reason;
            $dossier->closed_on = $to->isActive() ? null : Carbon::instance($today);
            $dossier->save();

            if (! $to->isActive()) {
                $this->revendications->releaseAll($dossier);
                $this->revoquerLiens($dossier);
            }

            $this->audit->handle('recovery.case.status_changed', subject: $dossier, metadata: ['from' => $avant->value, 'to' => $to->value]);

            return $dossier;
        });
    }

    private function revoquerLiens(RecoveryCase $dossier): void
    {
        $maintenant = CarbonImmutable::now();
        $actives = RecoveryTransmission::query()
            ->whereIn('bundle_id', RecoveryBundle::query()->where('case_id', $dossier->id)->select('id'))
            ->whereNull('revoked_at')
            ->where('expires_at', '>', Carbon::instance($maintenant))
            ->orderBy('created_at')->orderBy('id')
            ->get();

        foreach ($actives as $transmission) {
            $this->revocation->handle($transmission, 'Clôture du dossier', $maintenant);
        }
    }
}
