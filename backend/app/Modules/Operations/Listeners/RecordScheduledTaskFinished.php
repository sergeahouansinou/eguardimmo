<?php

declare(strict_types=1);

namespace App\Modules\Operations\Listeners;

use App\Modules\Operations\Support\ScheduledTaskJournal;
use Illuminate\Console\Events\ScheduledTaskFinished;

final readonly class RecordScheduledTaskFinished
{
    public function __construct(private ScheduledTaskJournal $journal) {}

    public function handle(ScheduledTaskFinished $evenement): void
    {
        $this->journal->finished($evenement->task, $evenement->runtime);
    }
}
