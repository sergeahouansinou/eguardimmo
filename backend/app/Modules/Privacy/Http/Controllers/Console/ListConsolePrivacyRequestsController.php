<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Privacy\Http\Requests\ListConsolePrivacyRequestsRequest;
use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;
use App\Modules\Privacy\Queries\PrivacyRequests;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListConsolePrivacyRequestsController
{
    public function __invoke(ListConsolePrivacyRequestsRequest $requete, PrivacyRequests $demandes, ConsoleRequestViews $vues): AnonymousResourceCollection
    {
        $page = $demandes->page($requete->status(), $requete->kind(), $requete->overdue(), $requete->cursor(), $requete->perPage());
        $comptes = $demandes->counts();

        return ConsolePrivacyRequestResource::collection($vues->of($page->items()))->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'open_count' => $comptes['open'],
            'overdue_count' => $comptes['overdue'],
        ]]);
    }
}
