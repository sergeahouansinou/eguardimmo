<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Http\Requests\RestrictCounterpartRequest;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Restreint la contrepartie du fil : elle lit, n'ouvre ni ne répond. Réservé à `owner` et `admin`, avec la 2FA.
 */
final class MuteCounterpartController
{
    public function __invoke(RestrictCounterpartRequest $request, string $conversation, StaffThreads $fils, StaffDesk $bureau, StaffAccess $acces): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->find($user->id, $conversation) ?? throw ErrorCode::ConversationNotFound->problem();
        $acces->assertAdministrator($user, $fil->kind);
        $bureau->restrict($fil, $request->days(), $request->reason());

        return $bureau->show($bureau->fresh($user, $conversation), $user, 1);
    }
}
