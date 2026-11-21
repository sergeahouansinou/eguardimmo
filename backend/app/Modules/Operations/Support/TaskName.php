<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support;

use Illuminate\Console\Scheduling\Event;
use Illuminate\Support\Str;

/**
 * Nom stable d'une tâche planifiée : la commande artisan, sans chemin ni argument.
 */
final class TaskName
{
    public static function of(Event $tache): string
    {
        $commande = (string) $tache->command;

        if (preg_match('/artisan[\'"]?\s+([A-Za-z0-9:_-]+)/', $commande, $trouvailles) === 1) {
            return $trouvailles[1];
        }

        return Str::limit($tache->getSummaryForDisplay(), 120, '');
    }
}
