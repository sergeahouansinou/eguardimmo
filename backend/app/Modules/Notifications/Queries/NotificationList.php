<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Data\NotificationFilters;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class NotificationList
{
    public function __construct(private VisibleNotifications $visibles) {}

    /**
     * Du plus récent au plus ancien : l'identifiant UUID v7 suit l'ordre de création.
     *
     * @return CursorPaginator<int, Notification>
     */
    public function page(string $userId, NotificationFilters $filtres, ?string $cursor, int $parPage): CursorPaginator
    {
        return $this->visibles->for($userId, $filtres)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $cursor === null ? null : Cursor::fromEncoded($cursor));
    }

    public function unreadCount(string $userId, ?string $organizationId = null): int
    {
        return $this->visibles->for($userId, new NotificationFilters(true, $organizationId))->count();
    }
}
