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
        return $this->listed($hashes, [$this->organisation->id(), MailSuppression::PLATEFORME]);
    }

    /**
     * Rebonds et plaintes de la plateforme seulement, sans contexte d'organisation : campagnes de la plateforme (ADR 0042).
     *
     * @param  list<string>  $hashes
     * @return array<string, true>
     */
    public function platform(array $hashes): array
    {
        return $this->listed($hashes, [MailSuppression::PLATEFORME]);
    }

    /**
     * @param  list<string>  $hashes
     * @param  list<string>  $portees
     * @return array<string, true>
     */
    private function listed(array $hashes, array $portees): array
    {
        $hashes = array_values(array_unique($hashes));

        if ($hashes === []) {
            return [];
        }

        $trouves = [];

        foreach (array_chunk($hashes, 500) as $paquet) {
            foreach (MailSuppression::query()
                ->whereIn('email_hash', $paquet)
                ->whereIn('scope_key', $portees)
                ->pluck('email_hash') as $hash) {
                $trouves[(string) $hash] = true;
            }
        }

        return $trouves;
    }
}
