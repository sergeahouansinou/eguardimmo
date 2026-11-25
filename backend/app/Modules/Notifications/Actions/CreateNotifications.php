<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Jobs\DeliverEmail;
use App\Modules\Notifications\Jobs\DeliverPush;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Queries\EffectivePreferences;
use App\Modules\Notifications\Support\PrimaryAddressAlert;
use App\Modules\Notifications\Support\Recipients;
use App\Modules\Notifications\Support\Templates;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;

final readonly class CreateNotifications
{
    public function __construct(
        private CurrentOrganization $contexte,
        private LeaseDirectory $baux,
        private Recipients $destinataires,
        private EffectivePreferences $preferences,
        private Templates $gabarits,
        private PrimaryAddressAlert $alerteAdresse,
    ) {}

    /**
     * Une notification par destinataire et par événement : la clé (compte, type, clé de dédoublonnage) rend un rejeu sans
     * effet et rien n'est renvoyé deux fois. Un destinataire qui a désactivé tous les canaux n'a aucune ligne. L'envoi
     * des e-mails et des push part en file, après l'écriture.
     *
     * @return int notifications créées
     */
    public function handle(NotificationInput $entree): int
    {
        $creees = $entree->organizationId === null ? $this->create($entree) : $this->contexte->run($entree->organizationId, fn (): array => $this->create($entree));

        foreach ($creees as $notification) {
            if ($notification->email) {
                DeliverEmail::dispatch($notification->id);
            }

            if ($notification->push) {
                DeliverPush::dispatch($notification->id);
            }
        }

        return count($creees);
    }

    /**
     * @return list<Notification>
     */
    private function create(NotificationInput $entree): array
    {
        $bail = $entree->leaseId === null ? null : $this->baux->find($entree->leaseId);
        $complete = $bail === null ? $entree : new NotificationInput($entree->type, $entree->organizationId, $entree->dedupKey, [...$entree->params, 'reference' => $bail->reference], $entree->leaseId, $entree->subjectId, $entree->partyId, $entree->assigneeId, $entree->readMarkers, $entree->recipientId, $entree->channels);

        $comptes = $this->destinataires->for($complete, $bail);
        $canaux = $this->preferences->channelsFor($comptes, $complete->type);
        $texte = $this->gabarits->render($complete);
        $lien = $this->gabarits->link($complete);
        $creees = [];

        foreach ($comptes as $compte) {
            $retenus = $canaux[$compte] ?? [];

            if ($complete->channels !== null) {
                $retenus = array_values(array_filter($retenus, fn (NotificationChannel $canal): bool => in_array($canal, $complete->channels, true)));
            }

            if ($retenus === []) {
                continue;
            }

            try {
                $creees[] = Notification::query()->create([
                    'user_id' => $compte,
                    'organization_id' => $complete->organizationId,
                    'audience' => $complete->type->audience(),
                    'type' => $complete->type,
                    'dedup_key' => $complete->readMarkers === null ? $complete->dedupKey : $complete->dedupKey.':'.($complete->readMarkers[$compte] ?? 'never'),
                    'title' => $texte['title'],
                    'body' => $texte['body'],
                    'link' => $lien,
                    'lease_id' => $complete->leaseId,
                    'party_id' => $complete->partyId,
                    'in_app' => in_array(NotificationChannel::InApp, $retenus, true),
                    'email' => in_array(NotificationChannel::Email, $retenus, true),
                    'push' => in_array(NotificationChannel::Push, $retenus, true),
                ]);
            } catch (UniqueConstraintViolationException) {
                continue;
            }
        }

        $this->alerteAdresse->send($creees);

        return $creees;
    }
}
