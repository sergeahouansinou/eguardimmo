<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Queries\SupportTickets;
use Illuminate\Http\JsonResponse;

final class TicketStatsController
{
    public function __invoke(SupportTickets $tickets): JsonResponse
    {
        return new JsonResponse(['data' => $tickets->stats()]);
    }
}
