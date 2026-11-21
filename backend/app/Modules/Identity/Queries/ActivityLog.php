<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\ActivityFilters;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\ActivityDisclosure;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\AuditLogBuilder;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Collection;

final class ActivityLog
{
    public const RELATION_AUTEUR = 'actor';

    public const ATTRIBUT_DIVULGUE = 'disclosed';

    public function __construct(private readonly ActivityDisclosure $divulgation) {}

    /**
     * @return CursorPaginator<int, AuditLog>
     */
    public function list(ActivityFilters $filtres, string $operateurId): CursorPaginator
    {
        /** @var AuditLogBuilder $requete */
        $requete = AuditLog::query();

        $page = $requete
            ->when($filtres->actorId !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->byActor((string) $filtres->actorId))
            ->when($filtres->subjectType !== null && $filtres->subjectId !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->forSubject((string) $filtres->subjectType, (string) $filtres->subjectId))
            ->when($filtres->subjectType !== null && $filtres->subjectId === null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->where('subject_type', $filtres->subjectType))
            ->when($filtres->actionPrefix !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->actionStartingWith((string) $filtres->actionPrefix))
            ->when($filtres->organizationId !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->inOrganization((string) $filtres->organizationId))
            ->when($filtres->requestId !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->where('request_id', $filtres->requestId))
            ->occurredBetween($filtres->from, $filtres->to)
            ->newestFirst()
            ->cursorPaginate($filtres->perPage);

        $entrees = collect($page->items());
        $this->marquerDivulgation($entrees, $operateurId);
        $this->joindreAuteurs($entrees);

        return $page;
    }

    public function find(string $id, string $operateurId): AuditLog
    {
        $entree = AuditLog::query()->findOrFail($id);
        $this->marquerDivulgation(collect([$entree]), $operateurId);
        $this->joindreAuteurs(collect([$entree]));

        return $entree;
    }

    /**
     * Une entrée qui porte une organisation n'est servie en entier qu'à un opérateur qui a un accès de support vivant sur elle.
     *
     * @param  Collection<int, AuditLog>  $entrees
     */
    private function marquerDivulgation(Collection $entrees, string $operateurId): void
    {
        $verdicts = [];

        $entrees->each(function (AuditLog $entree) use ($operateurId, &$verdicts): void {
            $organisation = $entree->organization_id;
            $divulgue = $organisation === null || ($verdicts[$organisation] ??= $this->divulgation->allows($operateurId, $organisation));
            $entree->setAttribute(self::ATTRIBUT_DIVULGUE, $divulgue);
        });
    }

    /**
     * @param  Collection<int, AuditLog>  $entrees
     */
    private function joindreAuteurs(Collection $entrees): void
    {
        $identifiants = $entrees->filter(fn (AuditLog $entree): bool => $entree->getAttribute(self::ATTRIBUT_DIVULGUE) === true)->pluck('actor_user_id')->filter()->unique()->values();
        $auteurs = User::withTrashed()->whereIn('id', $identifiants)->get(['id', 'name', 'email'])->keyBy('id');

        $entrees->each(fn (AuditLog $entree) => $entree->setRelation(self::RELATION_AUTEUR, $auteurs->get((string) $entree->actor_user_id)));
    }
}
