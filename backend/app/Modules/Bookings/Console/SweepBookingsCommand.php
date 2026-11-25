<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Console;

use App\Modules\Bookings\Actions\CompleteElapsedBookings;
use App\Modules\Bookings\Actions\ExpirePendingBookings;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class SweepBookingsCommand extends Command
{
    protected $signature = 'bookings:sweep';

    protected $description = 'Expire les réservations non payées au bout de 30 minutes et termine les séjours passés';

    public function handle(ExpirePendingBookings $expirer, CompleteElapsedBookings $terminer): int
    {
        $expirees = $expirer->handle(CarbonImmutable::now());
        $terminees = $terminer->handle();

        $this->info("{$expirees} réservation(s) expirée(s), {$terminees} séjour(s) terminé(s).");

        return self::SUCCESS;
    }
}
