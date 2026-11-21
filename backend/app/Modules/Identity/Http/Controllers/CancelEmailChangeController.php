<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\CancelEmailChange;
use App\Modules\Identity\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class CancelEmailChangeController
{
    public function __invoke(Request $request, CancelEmailChange $action): Response
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($user);

        return response()->noContent();
    }
}
