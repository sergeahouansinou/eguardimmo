<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;

final readonly class NotificationInput
{
    /**
     * @param  array<string, string>  $params  valeurs du gabarit : date (Y-m-d), label ; `reference` est ajoutée depuis le bail
     * @param  string|null  $leaseId  bail concerné, clé de lecture du locataire et destination du lien
     * @param  string|null  $subjectId  objet concerné quand le lien en dépend
     * @param  string|null  $partyId  mandant concerné (clé de lecture et destinataires d'un type `owner.*`) ou fiche du locataire d'un type `tenant.*` qui ne vise qu'elle
     * @param  string|null  $assigneeId  membre à prévenir seul pour un type d'équipe, tant qu'il peut encore le lire
     * @param  string|null  $organizationId  null pour un type d'audience `account` (compte sans organisation)
     * @param  string|null  $recipientId  compte seul destinataire, tant qu'il peut encore lire l'objet : un avis qui ne concerne qu'une personne
     * @param  array<string, string>  $readMarkers  dernière lecture par compte : la clé de dédoublonnage devient `{clé}:{marqueur}`, `never` sans lecture,
     *                                              donc une seule notification par sujet tant que le destinataire ne l'a pas lu
     * @param  list<NotificationChannel>|null  $channels  restreint les canaux retenus par les préférences (rappels : ceux de la règle)
     */
    public function __construct(
        public NotificationType $type,
        public ?string $organizationId,
        public string $dedupKey,
        public array $params = [],
        public ?string $leaseId = null,
        public ?string $subjectId = null,
        public ?string $partyId = null,
        public ?string $assigneeId = null,
        public ?array $readMarkers = null,
        public ?string $recipientId = null,
        public ?array $channels = null,
    ) {}
}
