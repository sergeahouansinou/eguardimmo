<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Resources;

use App\Modules\Planning\Data\TaskViewData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Le responsable se désigne par son identifiant : `assignee_active` faux marque un ex-membre, à afficher « inactif » jusqu'à réassignation.
 *
 * @property TaskViewData $resource
 */
final class TaskResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $t = $this->resource;

        return [
            'id' => $t->id,
            'title' => $t->title,
            'due_on' => $t->dueOn,
            'status' => $t->status->value,
            'is_overdue' => $t->isOverdue,
            'assignee_user_id' => $t->assigneeUserId,
            'assignee_active' => $t->assigneeActive,
            'done_at' => $t->doneAt?->toIso8601String(),
            'done_by_user_id' => $t->doneByUserId,
            'remind_days_before' => $t->remindDaysBefore,
            'property_id' => $t->propertyId,
            'unit_id' => $t->unitId,
            'lease_id' => $t->leaseId,
            'created_by_user_id' => $t->createdByUserId,
            'lock_version' => $t->lockVersion,
        ];
    }
}
