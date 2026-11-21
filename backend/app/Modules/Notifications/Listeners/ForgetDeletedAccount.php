<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Notifications\Actions\ForgetAccount;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class ForgetDeletedAccount implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly ForgetAccount $oubli) {}

    public function handle(AccountDeleted $evenement): void
    {
        $this->oubli->handle($evenement->userId);
    }
}
