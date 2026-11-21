<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Data\PartyDuplicateData;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyIdentifier;

final readonly class PartyDuplicates
{
    private const MAX_CANDIDATS = 10;

    /**
     * Fiches actives de l'organisation courante qui partagent un e-mail, un téléphone, un identifiant ou le nom d'un contact de même type.
     *
     * @param  list<string>  $emails  normalisés
     * @param  list<string>  $phones  toutes formes admises (E.164 et national)
     * @param  list<string>  $identifierHashes  empreintes `Fingerprinter::identifier`
     * @return list<PartyDuplicateData>
     */
    public function search(PartyKind $kind, string $displayName, array $emails, array $phones, array $identifierHashes): array
    {
        $raisons = [];

        foreach ($this->partiesParCoordonnee('email', $emails) as $id) {
            $raisons[$id][] = 'email';
        }

        foreach ($this->partiesParCoordonnee('phone', $phones) as $id) {
            $raisons[$id][] = 'phone';
        }

        if ($identifierHashes !== []) {
            foreach (PartyIdentifier::query()->whereIn('value_hash', $identifierHashes)->pluck('party_id') as $id) {
                $raisons[(string) $id][] = 'identifier';
            }
        }

        $nom = mb_strtolower((string) preg_replace('/\s+/', ' ', trim($displayName)));

        $actives = Party::query()
            ->whereNull('archived_at')
            ->whereNull('anonymized_at')
            ->where('kind', $kind->value)
            ->where(function ($q) use ($raisons, $nom): void {
                $q->whereIn('id', array_keys($raisons));

                if ($nom !== '') {
                    $q->orWhereRaw('LOWER(display_name) = ?', [$nom]);
                }
            })
            ->orderBy('display_name')
            ->orderBy('id')
            ->limit(self::MAX_CANDIDATS)
            ->get(['id', 'display_name']);

        return array_values($actives->map(function (Party $partie) use ($raisons, $nom): PartyDuplicateData {
            $motifs = $raisons[$partie->id] ?? [];

            if ($nom !== '' && mb_strtolower($partie->display_name) === $nom) {
                $motifs[] = 'name';
            }

            return new PartyDuplicateData($partie->id, $partie->display_name, $motifs);
        })->all());
    }

    /**
     * @param  list<string>  $valeurs
     * @return list<string>
     */
    private function partiesParCoordonnee(string $type, array $valeurs): array
    {
        if ($valeurs === []) {
            return [];
        }

        return array_values(array_map(
            strval(...),
            ContactPoint::query()->where('type', $type)->whereIn('value', $valeurs)->pluck('party_id')->all(),
        ));
    }
}
