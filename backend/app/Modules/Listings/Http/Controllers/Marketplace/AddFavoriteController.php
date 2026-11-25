<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Actions\AddFavorite;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class AddFavoriteController
{
    public function __invoke(string $ref, Request $request, AddFavorite $ajouter): Response
    {
        $ajouter->handle((string) $request->user()?->getAuthIdentifier(), $ref);

        return response()->noContent();
    }
}
