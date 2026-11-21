<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

final readonly class TaskChangesData
{
    /**
     * @param  array<string, mixed>  $fields  colonnes transmises seulement : title, due_on, assignee_user_id, remind_days_before, property_id, unit_id, lease_id
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
    ) {}
}
