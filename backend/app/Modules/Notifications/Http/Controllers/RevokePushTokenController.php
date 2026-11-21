<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Actions\RevokePushToken;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class RevokePushTokenController
{
    public function __invoke(Request $request, string $pushToken, RevokePushToken $revocation): Response
    {
        $revocation->handle((string) $request->user()?->getAuthIdentifier(), $pushToken);

        return response()->noContent();
    }
}
