<?php

declare(strict_types=1);

namespace App\Modules\Planning\Console;

use App\Modules\Planning\Actions\SendReminders;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class SendRemindersCommand extends Command
{
    protected $signature = 'planning:send-reminders';

    protected $description = 'Émet les rappels échus des événements et des tâches de l\'agenda';

    public function handle(SendReminders $rappels): int
    {
        $bilan = $rappels->handle(CarbonImmutable::now());

        $this->info("{$bilan['events']} rappel(s) d'événement, {$bilan['tasks']} rappel(s) de tâche, {$bilan['skipped']} sauté(s) pour retard.");

        foreach ($bilan['failures'] as $echec) {
            $this->error($echec);
        }

        return $bilan['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
