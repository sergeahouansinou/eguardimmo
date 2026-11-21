<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Http\Resources\Owner\OwnerPropertyResource;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerUnits;
use App\Modules\Mandates\Queries\OwnerUnitViews;
use Illuminate\Http\Request;

final class ShowOwnerPropertyController
{
    public function __invoke(string $unit, Request $request, MandateDirectory $repertoire, OwnerUnits $lots, OwnerUnitViews $vues): OwnerPropertyResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $repertoire->ownerScope($user->id);
        $cle = $lots->find($portee, $unit) ?? throw ErrorCode::OwnerUnitNotFound->problem();

        return new OwnerPropertyResource($vues->of($portee, [$cle])[0] ?? throw ErrorCode::OwnerUnitNotFound->problem());
    }
}
