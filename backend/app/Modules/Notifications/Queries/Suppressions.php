<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Models\MailSuppression;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Liste d'opposition : désinscriptions de l'organisation courante, rebonds et plaintes de toute la plateforme.
 */
final readonly class Suppressions
{
    public function __construct(private CurrentOrganization $organisation) {}

    /**
     * @param  list<string>  $hashes  empreintes d'adresse
     * @return array<string, true> empreintes à ne pas écrire
     */
    public function among(array $hashes): array
    {
        $hashes = array_values(array_unique($hashes));

        if ($hashes === []) {
            return [];
        }

        $trouves = [];

        foreach (array_chunk($hashes, 500) as $paquet) {
            foreach (MailSuppression::query()
                ->whereIn('email_hash', $paquet)
                ->whereIn('scope_key', [$this->organisation->id(), MailSuppression::PLATEFORME])
                ->pluck('email_hash') as $hash) {
                $trouves[(string) $hash] = true;
            }
        }

        return $trouves;
    }
}
