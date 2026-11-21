<?php

declare(strict_types=1);

namespace App\Modules\Operations\Listeners;

use App\Modules\Operations\Support\ScheduledTaskJournal;
use Illuminate\Console\Events\ScheduledTaskFailed;

final readonly class RecordScheduledTaskFailed
{
    public function __construct(private ScheduledTaskJournal $journal) {}

    public function handle(ScheduledTaskFailed $evenement): void
    {
        $this->journal->failed($evenement->task, $evenement->exception::class);
    }
}
