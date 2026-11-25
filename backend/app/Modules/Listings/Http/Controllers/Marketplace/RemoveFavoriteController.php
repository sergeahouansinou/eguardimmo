<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Actions\RemoveFavorite;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class RemoveFavoriteController
{
    public function __invoke(string $ref, Request $request, RemoveFavorite $retirer): Response
    {
        $retirer->handle((string) $request->user()?->getAuthIdentifier(), $ref);

        return response()->noContent();
    }
}
