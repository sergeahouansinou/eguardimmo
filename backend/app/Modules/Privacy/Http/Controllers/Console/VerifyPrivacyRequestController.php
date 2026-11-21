<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\VerifyRequesterIdentity;
use App\Modules\Privacy\Http\Requests\VerifyPrivacyRequestRequest;
use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;

final class VerifyPrivacyRequestController
{
    public function __invoke(VerifyPrivacyRequestRequest $requete, string $privacyRequest, VerifyRequesterIdentity $action, ConsoleRequestViews $vues): ConsolePrivacyRequestResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();

        return new ConsolePrivacyRequestResource($vues->one($action->handle($privacyRequest, $requete->verification(), $operateur), true));
    }
}
