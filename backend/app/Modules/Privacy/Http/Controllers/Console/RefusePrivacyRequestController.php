<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\RefusePrivacyRequest;
use App\Modules\Privacy\Http\Requests\RefusePrivacyRequestRequest;
use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;

final class RefusePrivacyRequestController
{
    public function __invoke(RefusePrivacyRequestRequest $requete, string $privacyRequest, RefusePrivacyRequest $action, ConsoleRequestViews $vues): ConsolePrivacyRequestResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();

        return new ConsolePrivacyRequestResource($vues->one($action->handle($privacyRequest, $requete->reason(), $operateur), true));
    }
}
