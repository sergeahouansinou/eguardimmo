<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Actions\SendReminders;
use Illuminate\Console\Command;

final class SendRemindersCommand extends Command
{
    protected $signature = 'notifications:send-reminders';

    protected $description = 'Envoie les rappels automatiques activés (ADR 0042)';

    public function handle(SendReminders $rappels): int
    {
        $bilan = $rappels->handle();
        $this->info("Rappels créés : {$bilan['sent']}. Échecs : {$bilan['failed']}.");

        return $bilan['failed'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
