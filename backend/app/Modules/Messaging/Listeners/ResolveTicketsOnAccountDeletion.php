<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Listeners;

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Messaging\Actions\ResolveAccountTickets;
use Illuminate\Contracts\Queue\ShouldQueue;

final class ResolveTicketsOnAccountDeletion implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(private readonly ResolveAccountTickets $resolution) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    public function handle(AccountDeleted $evenement): void
    {
        $this->resolution->handle($evenement->userId);
    }
}
