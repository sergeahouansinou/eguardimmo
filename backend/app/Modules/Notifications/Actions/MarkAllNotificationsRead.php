<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\NotificationFilters;
use App\Modules\Notifications\Queries\VisibleNotifications;

final readonly class MarkAllNotificationsRead
{
    public function __construct(private VisibleNotifications $visibles) {}

    /**
     * Ne touche que ce que le compte voit encore ; `$organizationId` restreint, il n'élargit jamais.
     */
    public function handle(string $userId, ?string $organizationId): int
    {
        return $this->visibles->for($userId, new NotificationFilters(true, $organizationId))->update(['read_at' => now()]);
    }
}
