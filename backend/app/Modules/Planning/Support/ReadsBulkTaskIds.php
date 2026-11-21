<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

/**
 * Plus de 100 identifiants se refusent dans l'action (`planning_bulk_too_large`, code documenté) ; la validation ne coupe qu'à 500.
 */
trait ReadsBulkTaskIds
{
    /**
     * @return array<string, list<mixed>>
     */
    private function idRules(): array
    {
        return ['ids' => ['required', 'array', 'min:1', 'max:'.(BulkTasks::MAX * 5)], 'ids.*' => ['uuid']];
    }

    /**
     * @return list<string>
     */
    public function ids(): array
    {
        return array_values(array_map(strval(...), (array) $this->validated('ids')));
    }
}
