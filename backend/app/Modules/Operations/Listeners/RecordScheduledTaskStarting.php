<?php

declare(strict_types=1);

namespace App\Modules\Operations\Listeners;

use App\Modules\Operations\Support\ScheduledTaskJournal;
use Illuminate\Console\Events\ScheduledTaskStarting;

final readonly class RecordScheduledTaskStarting
{
    public function __construct(private ScheduledTaskJournal $journal) {}

    public function handle(ScheduledTaskStarting $evenement): void
    {
        $this->journal->started($evenement->task);
    }
}
