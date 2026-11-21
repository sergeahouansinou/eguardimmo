<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Queries\ErasableParties;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Throwable;

final readonly class EraseAnonymizedParties
{
    public function __construct(
        private ErasableParties $candidates,
        private PartyDirectory $parties,
        private ErasePartyMessages $effacer,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Rattrapage quotidien de l'effacement déclenché par `PartyAnonymized` : le listener en file peut avoir épuisé ses reprises.
     *
     * @return array{erased: int, failures: list<string>}
     */
    public function handle(): array
    {
        $bilan = ['erased' => 0, 'failures' => []];

        foreach ($this->candidates->byOrganization() as $organisation => $fiches) {
            try {
                $this->contexte->run($organisation, function () use ($fiches, &$bilan): void {
                    foreach (array_chunk($fiches, 200) as $lot) {
                        foreach ($this->parties->findMany($lot) as $partie) {
                            if ($partie->isAnonymized) {
                                $bilan['erased'] += $this->effacer->handle($partie->id);
                            }
                        }
                    }
                });
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failures'][] = "{$organisation} : {$erreur->getMessage()}";
            }
        }

        return $bilan;
    }
}
