<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\CompletePrivacyRequest;
use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;
use Illuminate\Http\Request;

final class CompletePrivacyRequestController
{
    public function __invoke(Request $requete, string $privacyRequest, CompletePrivacyRequest $cloture, ConsoleRequestViews $vues): ConsolePrivacyRequestResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();

        return new ConsolePrivacyRequestResource($vues->one($cloture->handle($privacyRequest, $operateur), true));
    }
}
