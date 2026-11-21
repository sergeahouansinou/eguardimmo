<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryTransmission;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ResendTransmission
{
    public function __construct(
        private RevokeTransmission $revocation,
        private TransmitBundle $transmission,
    ) {}

    /**
     * Révoque l'ancien lien s'il est encore actif et en crée un nouveau pour le même envoi et le même destinataire, en une
     * transaction : si le nouveau lien est refusé, l'ancien reste actif. L'adresse e-mail est relue sur la fiche du destinataire.
     */
    public function handle(RecoveryTransmission $transmission, ?int $validDays, CarbonImmutable $now): RecoveryTransmission
    {
        return DB::transaction(function () use ($transmission, $validDays, $now): RecoveryTransmission {
            $envoi = RecoveryBundle::query()->findOrFail($transmission->bundle_id);
            RecoveryCase::query()->whereKey($envoi->case_id)->lockForUpdate()->firstOrFail();
            $ancienne = RecoveryTransmission::query()->whereKey($transmission->id)->lockForUpdate()->firstOrFail();

            if ($ancienne->revoked_at === null) {
                $this->revocation->handle($ancienne, 'Renvoi du lien', $now);
                $ancienne->refresh();
            }

            return $this->transmission->handle($envoi, $ancienne->recipient_party_id, $validDays, $now, $ancienne);
        });
    }
}
