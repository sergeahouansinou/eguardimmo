<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers;

use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\TicketLoader;
use Illuminate\Http\Request;

final class ShowMyTicketController
{
    public function __invoke(Request $request, string $ticket): TicketDetailResource
    {
        return new TicketDetailResource(TicketLoader::forRequester($request, $ticket), vueSupport: false);
    }
}
