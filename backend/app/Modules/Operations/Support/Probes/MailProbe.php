<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Notifications\PublicApi\MailHealth;
use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;

/**
 * E-mail : jamais d'appel à l'API du fournisseur. Seul un événement de webhook reçu dans les 24 dernières heures prouve qu'il répond ;
 * sinon rien ne permet de conclure.
 */
final readonly class MailProbe implements Probe
{
    public function __construct(private MailHealth $courrier) {}

    public function key(): string
    {
        return 'mail';
    }

    public function run(): ProbeResult
    {
        $etat = $this->courrier->snapshot();
        $recent = $etat->lastEventAt !== null && $etat->lastEventAt->greaterThan(now()->subDay());

        return new ProbeResult($etat->configured && $recent ? ProbeState::Ok : ProbeState::Unknown, [
            'configured' => $etat->configured,
            'last_event_at' => $etat->lastEventAt?->toIso8601String(),
            'bounces_24h' => $etat->bounces24h,
        ]);
    }
}
