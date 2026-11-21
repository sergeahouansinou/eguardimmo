<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Data\MailHealthData;
use App\Modules\Notifications\Models\MailProviderEvent;
use Carbon\CarbonImmutable;

/**
 * Ce que les webhooks du fournisseur d'e-mail ont déjà appris : aucun appel à son API.
 */
final class MailEvents
{
    public function health(): MailHealthData
    {
        $dernier = MailProviderEvent::query()->max('received_at');

        return new MailHealthData(
            configured: ! in_array((string) config('mail.default'), ['log', 'array', 'null', ''], true),
            lastEventAt: is_string($dernier) ? CarbonImmutable::parse($dernier) : null,
            bounces24h: MailProviderEvent::query()
                ->whereIn('type', ['bounce', 'reject'])
                ->whereRaw('received_at >= ?', [now()->subDay()->format('Y-m-d H:i:s.u')])
                ->count(),
        );
    }
}
