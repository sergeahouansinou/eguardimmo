<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class RevokeCurrentTokenController
{
    public function __invoke(Request $request, RecordAudit $audit): Response
    {
        /** @var User $user */
        $user = $request->user();
        $jeton = $user->currentAccessToken();

        if (! $jeton instanceof PersonalAccessToken) {
            throw ErrorCode::NoTokenToRevoke->problem();
        }

        $jeton->delete();
        $audit->handle('auth.token.revoked', $user->id, ['token_id' => $jeton->id]);

        return response()->noContent();
    }
}
