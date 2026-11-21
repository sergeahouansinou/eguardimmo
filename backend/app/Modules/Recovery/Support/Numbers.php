<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Recovery\Enums\SequenceKind;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class Numbers
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * `RC-AAAA-NNNN` (dossier) ou `EP-AAAA-NNNN` (envoi de pièces), continu par organisation, par type et par année ; à
     * appeler dans la transaction qui écrit la ligne, pour que son annulation libère le numéro.
     */
    public function next(SequenceKind $genre, CarbonImmutable $date): string
    {
        $numero = $this->compteur->next('recovery_sequences', [
            'organization_id' => $this->organisation->id(),
            'kind' => $genre->value,
            'year' => $date->year,
        ]);

        return sprintf('%s-%04d-%04d', $genre->prefix(), $date->year, $numero);
    }

    /**
     * Prochain numéro sans le consommer ni poser de verrou : à revérifier par `next()` sous verrou avant d'écrire.
     */
    public function peek(SequenceKind $genre, CarbonImmutable $date): string
    {
        $dernier = DB::table('recovery_sequences')
            ->where(['organization_id' => $this->organisation->id(), 'kind' => $genre->value, 'year' => $date->year])
            ->value('last_value');

        return sprintf('%s-%04d-%04d', $genre->prefix(), $date->year, (is_numeric($dernier) ? (int) $dernier : 0) + 1);
    }
}
