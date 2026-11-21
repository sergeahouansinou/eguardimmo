<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\ForwardToOrganizations;
use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;
use Illuminate\Http\Request;

final class ForwardPrivacyRequestController
{
    public function __invoke(Request $requete, string $privacyRequest, ForwardToOrganizations $transmission, ConsoleRequestViews $vues): ConsolePrivacyRequestResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();
        $resultat = $transmission->handle($privacyRequest, $operateur);

        return (new ConsolePrivacyRequestResource($vues->one($resultat['request'], true)))->additional(['meta' => ['forwarded' => $resultat['forwarded']]]);
    }
}
