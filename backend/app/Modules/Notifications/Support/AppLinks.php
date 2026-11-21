<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Models\Notification;

final class AppLinks
{
    /**
     * Adresse https complète du lien d'une notification ; null sans base https valide ou sans lien : le message part alors sans lien plutôt qu'avec un lien cassé.
     */
    public function absolute(Notification $notification): ?string
    {
        $base = config('notifications.urls.'.$notification->audience->value);

        if ($notification->link === null || ! is_string($base) || ! str_starts_with(strtolower($base), 'https://')) {
            return null;
        }

        return rtrim($base, '/').$notification->link;
    }
}
