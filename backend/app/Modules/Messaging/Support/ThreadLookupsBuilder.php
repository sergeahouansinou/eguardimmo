<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Mandates\Data\MandateData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;

final readonly class ThreadLookupsBuilder
{
    public function __construct(
        private CurrentOrganization $organisation,
        private OrganizationDirectory $organisations,
        private LeaseDirectory $baux,
        private MandateDirectory $mandats,
        private PartyDirectory $parties,
    ) {}

    /**
     * @param  iterable<Conversation>  $fils
     */
    public function for(iterable $fils, bool $equipe = false): ThreadLookups
    {
        $parOrganisation = [];
        $assignes = [];

        foreach ($fils as $fil) {
            $parOrganisation[$fil->organization_id][] = $fil;

            if ($fil->assignee_user_id !== null) {
                $assignes[$fil->assignee_user_id] = $fil->assignee_user_id;
            }
        }

        $baux = $mandats = $parties = [];

        foreach ($parOrganisation as $organisation => $liste) {
            $this->organisation->run((string) $organisation, function () use ($liste, $equipe, &$baux, &$mandats, &$parties): void {
                $baux += $this->resoudre(array_values(array_filter(array_map(fn (Conversation $f): ?string => $f->lease_id, $liste))), fn (array $ids): array => array_column(array_map(fn (LeaseData $b): array => [$b->id, $b->reference], $this->baux->findMany($ids)), 1, 0));
                $mandats += $this->resoudre(array_values(array_filter(array_map(fn (Conversation $f): ?string => $f->mandate_id, $liste))), fn (array $ids): array => array_map(fn (MandateData $m): string => $m->reference, $this->mandats->findMany($ids)));

                if ($equipe) {
                    $parties += $this->resoudre(array_values(array_filter(array_map(fn (Conversation $f): ?string => $f->party_id, $liste))), fn (array $ids): array => array_map(fn (PartyData $p): string => $p->displayName, $this->parties->findMany($ids)));
                }
            });
        }

        return new ThreadLookups(
            $this->organisations->names(array_map('strval', array_keys($parOrganisation))),
            $baux,
            $mandats,
            $parties,
            $assignes === [] ? [] : User::query()->whereIn('id', array_values($assignes))->pluck('name', 'id')->map(fn (mixed $nom): string => (string) $nom)->all(),
        );
    }

    /**
     * Un identifiant disparu ne fait pas échouer la page : le libellé manque, le fil reste lisible.
     *
     * @param  list<string>  $ids
     * @param  Closure(list<string>): array<string, string>  $lire
     * @return array<string, string>
     */
    private function resoudre(array $ids, Closure $lire): array
    {
        if ($ids === []) {
            return [];
        }

        try {
            return $lire(array_values(array_unique($ids)));
        } catch (ApiProblem) {
            return [];
        }
    }
}
