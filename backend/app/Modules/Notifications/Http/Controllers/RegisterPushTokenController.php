<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Actions\RegisterPushToken;
use App\Modules\Notifications\Http\Requests\RegisterPushTokenRequest;
use App\Modules\Notifications\Http\Resources\PushTokenResource;
use Illuminate\Http\JsonResponse;

final class RegisterPushTokenController
{
    public function __invoke(RegisterPushTokenRequest $request, RegisterPushToken $enregistrement): JsonResponse
    {
        $jeton = $enregistrement->handle($request->toData());

        return (new PushTokenResource($jeton))->response()->setStatusCode($jeton->wasRecentlyCreated ? 201 : 200);
    }
}
