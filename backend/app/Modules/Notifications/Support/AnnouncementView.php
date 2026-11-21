<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use Carbon\CarbonImmutable;

/**
 * Une annonce telle que la lit un locataire ou un mandant : texte fusionné avec ses valeurs, pièces à télécharger depuis l'espace.
 */
final readonly class AnnouncementView
{
    /**
     * @param  list<array{id: string, name: string, size_bytes: int}>  $attachments
     */
    public function __construct(
        public string $campaignId,
        public string $notificationId,
        public string $organizationId,
        public string $organizationName,
        public string $subject,
        public string $body,
        public bool $contentPurged,
        public ?CarbonImmutable $sentAt,
        public ?CarbonImmutable $readAt,
        public array $attachments,
    ) {}
}
