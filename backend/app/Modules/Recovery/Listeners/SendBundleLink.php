<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Listeners;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Recovery\Events\RecoveryBundleSent;
use App\Modules\Recovery\Mail\BundleLinkMail;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Support\TransmissionLink;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Envoi minimal de l'e-mail en attendant le module Notifications (décision hors ADR 0023, à valider). Chiffré en file :
 * l'événement porte le jeton en clair.
 */
final class SendBundleLink implements ShouldBeEncrypted, ShouldQueue
{
    public int $tries = 5;

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    public function __construct(
        private readonly CurrentOrganization $contexte,
        private readonly OrganizationDirectory $organisations,
        private readonly TransmissionLink $liens,
    ) {}

    /**
     * Idempotent : un lien déjà envoyé, révoqué ou expiré n'est jamais renvoyé par un rejeu ; `sent_at` n'est posé qu'après l'envoi.
     */
    public function handle(RecoveryBundleSent $evenement): void
    {
        $this->contexte->run($evenement->organizationId, function () use ($evenement): void {
            $transmission = RecoveryTransmission::query()->find($evenement->transmissionId);

            if ($transmission === null || $transmission->sent_at !== null || ! $transmission->isUsable(Carbon::now())) {
                return;
            }

            $envoi = RecoveryBundle::query()->findOrFail($transmission->bundle_id);
            $dossier = RecoveryCase::query()->findOrFail($envoi->case_id);
            $nom = $this->organisations->names([$evenement->organizationId])[$evenement->organizationId] ?? '';

            Mail::to($transmission->recipient_email)->send(new BundleLinkMail(
                $nom,
                $dossier->number,
                $transmission->expires_at->format('d/m/Y à H:i'),
                $this->liens->build($evenement->token),
            ));

            $transmission->sent_at = Carbon::now();
            $transmission->save();
        });
    }

    /**
     * Tentatives épuisées : l'échec est visible dans les journaux, sans jeton ni adresse (l'événement porte le jeton en clair).
     */
    public function failed(RecoveryBundleSent $evenement, Throwable $erreur): void
    {
        Log::error('Envoi du lien de transmission abandonné après épuisement des tentatives', [
            'organization_id' => $evenement->organizationId,
            'transmission_id' => $evenement->transmissionId,
            'exception' => $erreur::class,
        ]);
    }
}
