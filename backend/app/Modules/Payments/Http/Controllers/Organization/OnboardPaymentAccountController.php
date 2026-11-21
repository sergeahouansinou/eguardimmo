<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Payments\Actions\OnboardPaymentAccount;
use App\Modules\Payments\Http\Resources\PaymentAccountResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OnboardPaymentAccountController
{
    public function __invoke(Request $request, OnboardPaymentAccount $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resultat = $action->handle($user);

        return (new PaymentAccountResource($resultat['account'], $resultat['onboarding_url']))->response()->setStatusCode(200);
    }
}
