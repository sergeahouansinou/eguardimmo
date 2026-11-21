<?php

declare(strict_types=1);

namespace App\Modules\Notifications\PublicApi;

use App\Modules\Notifications\Data\MailHealthData;
use App\Modules\Notifications\Queries\MailEvents;

/**
 * Santé de l'envoi d'e-mails pour la console : fournisseur configuré, dernier événement de webhook, rebonds sur 24 heures.
 */
final readonly class MailHealth
{
    public function __construct(private MailEvents $evenements) {}

    public function snapshot(): MailHealthData
    {
        return $this->evenements->health();
    }
}
