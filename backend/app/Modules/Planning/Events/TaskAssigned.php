<?php

declare(strict_types=1);

namespace App\Modules\Planning\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Une tâche vient d'être confiée à un membre. Identifiants seulement : ni titre ni libellé ne voyagent avec l'événement.
 */
final readonly class TaskAssigned implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $taskId,
        public string $organizationId,
        public string $assigneeUserId,
        public ?string $assignedByUserId,
        public int $lockVersion,
    ) {}
}
