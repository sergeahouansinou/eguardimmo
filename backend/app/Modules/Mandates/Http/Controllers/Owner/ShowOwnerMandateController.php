<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Http\Resources\Owner\OwnerMandateResource;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerMandates;
use App\Modules\Mandates\Queries\OwnerMandateViews;
use Illuminate\Http\Request;

final class ShowOwnerMandateController
{
    public function __invoke(string $mandate, Request $request, MandateDirectory $repertoire, OwnerMandates $mandats, OwnerMandateViews $vues): OwnerMandateResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $repertoire->ownerScope($user->id);
        $mandat = $mandats->find($portee, $mandate) ?? throw ErrorCode::OwnerMandateNotFound->problem();

        return new OwnerMandateResource($vues->of($portee, [$mandat])[0] ?? throw ErrorCode::OwnerMandateNotFound->problem());
    }
}
