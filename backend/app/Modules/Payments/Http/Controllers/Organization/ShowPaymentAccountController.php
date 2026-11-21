<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers\Organization;

use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Http\Resources\PaymentAccountResource;
use App\Modules\Payments\Models\PaymentAccount;
use Illuminate\Http\JsonResponse;

final class ShowPaymentAccountController
{
    public function __invoke(PaymentGateway $passerelle): PaymentAccountResource|JsonResponse
    {
        $compte = PaymentAccount::query()->where('provider', $passerelle->name())->first();

        return $compte === null ? new JsonResponse(['data' => null]) : new PaymentAccountResource($compte);
    }
}
