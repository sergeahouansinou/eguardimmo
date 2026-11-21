<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers;

use App\Modules\Payments\Actions\ProcessPaymentWebhook;
use App\Modules\Payments\Gateways\PaymentGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaymentWebhookController
{
    public function __invoke(string $provider, Request $request, PaymentGateway $passerelle, ProcessPaymentWebhook $action): JsonResponse
    {
        $action->handle($provider, $request->getContent(), $request->header($passerelle->signatureHeader()));

        return new JsonResponse(['received' => true]);
    }
}
