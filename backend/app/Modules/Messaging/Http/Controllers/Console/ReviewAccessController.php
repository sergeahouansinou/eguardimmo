<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\ReviewEmergencyAccess;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Http\Resources\Console\SupportAccessGrantResource;
use App\Modules\Messaging\Models\SupportAccessGrant;
use Illuminate\Http\Request;

final class ReviewAccessController
{
    public function __invoke(Request $request, string $grant, ReviewEmergencyAccess $revue): SupportAccessGrantResource
    {
        /** @var User $relecteur */
        $relecteur = $request->user();
        $acces = SupportAccessGrant::query()->find($grant) ?? throw ErrorCode::SupportAccessNotFound->problem();

        return new SupportAccessGrantResource($revue->handle($acces, $relecteur)->load('operator'));
    }
}
