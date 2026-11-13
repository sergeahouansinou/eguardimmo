<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\IssueMobileToken;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class RevokeDeviceController
{
    public function __invoke(Request $request, string $device, RecordAudit $audit): Response
    {
        /** @var User $user */
        $user = $request->user();

        $jeton = $user->tokens()
            ->whereKey($device)
            ->where('abilities', 'like', '%"'.IssueMobileToken::CAPACITE.'"%')
            ->firstOrFail();

        $jeton->delete();
        $audit->handle('auth.token.revoked', $user->id, ['token_id' => $device]);

        return response()->noContent();
    }
}
