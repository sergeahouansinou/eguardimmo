<?php

declare(strict_types=1);

namespace App\Modules\Planning\Queries;

use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Data\TaskFilters;
use App\Modules\Planning\Data\TaskPageData;
use App\Modules\Planning\Data\TaskViewData;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Models\PlanningTask;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class Tasks
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private OrganizationDirectory $organisation,
    ) {}

    public function get(string $id): PlanningTask
    {
        return (Str::isUuid($id) ? PlanningTask::query()->find($id) : null) ?? throw ErrorCode::TaskNotFound->problem();
    }

    public function view(PlanningTask $tache): TaskViewData
    {
        return $this->views([$tache])[0];
    }

    public function page(TaskFilters $filtres): TaskPageData
    {
        $aujourdhui = $this->aujourdhui();

        $page = PlanningTask::query()
            ->when($filtres->status === null, fn (Builder $q) => $q->whereIn('status', [TaskStatus::Open->value, TaskStatus::Done->value]))
            ->when($filtres->status !== null, fn (Builder $q) => $q->where('status', $filtres->status?->value))
            ->when($filtres->assigneeUserId !== null, fn (Builder $q) => $q->where('assignee_user_id', $filtres->assigneeUserId))
            ->when($filtres->propertyId !== null, fn (Builder $q) => $q->where('property_id', $filtres->propertyId))
            ->when($filtres->unitId !== null, fn (Builder $q) => $q->where('unit_id', $filtres->unitId))
            ->when($filtres->dueFrom !== null, fn (Builder $q) => $q->where('due_on', '>=', $filtres->dueFrom))
            ->when($filtres->dueTo !== null, fn (Builder $q) => $q->where('due_on', '<', $filtres->dueTo))
            ->when($filtres->overdue, fn (Builder $q) => $q->where('status', TaskStatus::Open->value)->where('due_on', '<', $aujourdhui))
            ->orderBy('due_on')
            ->orderBy('id')
            ->cursorPaginate($filtres->perPage);

        /** @var list<PlanningTask> $taches */
        $taches = array_values($page->items());

        return new TaskPageData($this->views($taches), $page->hasMorePages(), $page->nextCursor()?->encode());
    }

    /**
     * @param  list<PlanningTask>  $taches
     * @return list<TaskViewData>
     */
    public function views(array $taches): array
    {
        $actifs = array_fill_keys(array_map(fn (TeamMemberData $m): string => $m->userId, $this->adhesions->activeTeam()), true);
        $aujourdhui = $this->aujourdhui();

        return array_map(fn (PlanningTask $t): TaskViewData => new TaskViewData(
            $t->id,
            $t->title,
            $t->due_on->toDateString(),
            $t->status,
            $t->status === TaskStatus::Open && $t->due_on->toDateString() < $aujourdhui,
            $t->assignee_user_id,
            $t->assignee_user_id === null ? null : isset($actifs[$t->assignee_user_id]),
            $t->done_at,
            $t->done_by_user_id,
            $t->remind_days_before,
            $t->property_id,
            $t->unit_id,
            $t->lease_id,
            $t->created_by_user_id,
            $t->lock_version,
        ), $taches);
    }

    private function aujourdhui(): string
    {
        return CarbonImmutable::now($this->organisation->timezone())->toDateString();
    }
}
