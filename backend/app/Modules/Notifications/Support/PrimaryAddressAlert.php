<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Jobs\DeliverAddressEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Parties\PublicApi\PartyDirectory;

/**
 * Une alerte de sécurité du mandant part aussi vers l'adresse principale de sa fiche, sauf si un compte destinataire la porte déjà.
 * À appeler sous le contexte de l'organisation de l'événement.
 */
final readonly class PrimaryAddressAlert
{
    public function __construct(
        private PartyDirectory $parties,
        private AppLinks $liens,
    ) {}

    /**
     * @param  list<Notification>  $creees  notifications que l'événement vient de créer
     */
    public function send(array $creees): void
    {
        $premiere = $creees[0] ?? null;

        if ($premiere === null || $premiere->party_id === null || ! $premiere->type->alertsPrimaryAddress()) {
            return;
        }

        $adresse = $this->parties->primaryEmail($premiere->party_id);

        if ($adresse === null) {
            return;
        }

        $dejaServis = User::query()->whereIn('id', array_map(fn (Notification $n): string => $n->user_id, array_filter($creees, fn (Notification $n): bool => $n->email)))->pluck('email')->map(fn (string $e): string => mb_strtolower($e))->all();

        if (in_array(mb_strtolower($adresse), $dejaServis, true)) {
            return;
        }

        DeliverAddressEmail::dispatch($adresse, $premiere->title, $premiere->body, $this->liens->absolute($premiere));
    }
}
