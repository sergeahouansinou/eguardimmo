<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\ActivityFilters;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\AuditLogBuilder;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Collection;

final class ActivityLog
{
    public const RELATION_AUTEUR = 'actor';

    /**
     * @return CursorPaginator<int, AuditLog>
     */
    public function list(ActivityFilters $filtres): CursorPaginator
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

        $this->joindreAuteurs(collect($page->items()));

        return $page;
    }

    public function find(string $id): AuditLog
    {
        $entree = AuditLog::query()->findOrFail($id);
        $this->joindreAuteurs(collect([$entree]));

        return $entree;
    }

    /**
     * @param  Collection<int, AuditLog>  $entrees
     */
    private function joindreAuteurs(Collection $entrees): void
    {
        $identifiants = $entrees->pluck('actor_user_id')->filter()->unique()->values();
        $auteurs = User::query()->whereIn('id', $identifiants)->get(['id', 'name', 'email'])->keyBy('id');

        $entrees->each(fn (AuditLog $entree) => $entree->setRelation(self::RELATION_AUTEUR, $auteurs->get((string) $entree->actor_user_id)));
    }
}
