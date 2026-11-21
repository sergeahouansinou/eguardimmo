<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\ArchiveChargeKey;
use App\Modules\Charges\Http\Resources\ChargeKeyResource;

final class ArchiveChargeKeyController
{
    public function __invoke(string $property, string $key, ArchiveChargeKey $archiver): ChargeKeyResource
    {
        return new ChargeKeyResource($archiver->handle($property, $key));
    }
}
