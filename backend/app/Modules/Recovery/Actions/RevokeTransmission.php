<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Enums\ActType;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class RevokeTransmission
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Verrouille le dossier puis le lien (même ordre que la clôture), ferme le lien et inscrit l'acte `revocation` au carnet, dans la même transaction. Un lien déjà révoqué est refusé (409).
     */
    public function handle(RecoveryTransmission $transmission, ?string $reason, CarbonImmutable $now): RecoveryTransmission
    {
        return DB::transaction(function () use ($transmission, $reason, $now): RecoveryTransmission {
            $envoi = RecoveryBundle::query()->findOrFail(RecoveryTransmission::query()->whereKey($transmission->id)->firstOrFail()->bundle_id);
            RecoveryCase::query()->whereKey($envoi->case_id)->lockForUpdate()->firstOrFail();
            $courante = RecoveryTransmission::query()->whereKey($transmission->id)->lockForUpdate()->firstOrFail();

            if ($courante->revoked_at !== null) {
                throw ErrorCode::TransmissionNotActive->problem();
            }

            $courante->revoked_at = Carbon::instance($now);
            $courante->revoked_by_user_id = is_string(auth()->id()) ? auth()->id() : null;
            $courante->save();

            RecoveryAct::query()->create([
                'case_id' => $envoi->case_id,
                'type' => ActType::Revocation,
                'performed_on' => $now->toDateString(),
                'author_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                'reference' => $envoi->number,
                'note' => $reason,
                'data' => ['bundle_id' => $envoi->id, 'transmission_id' => $courante->id, 'recipient_party_id' => $courante->recipient_party_id],
            ]);

            $this->audit->handle('recovery.transmission.revoked', subject: $courante, metadata: ['bundle' => $envoi->number]);

            return $courante;
        });
    }
}
