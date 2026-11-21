<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Http\Resources\MandateTermDefaultsResource;
use App\Modules\Mandates\Models\MandateTermDefault;

final class ShowMandateTermDefaultsController
{
    public function __invoke(): MandateTermDefaultsResource
    {
        return new MandateTermDefaultsResource(MandateTermDefault::query()->first() ?? throw ErrorCode::MandateTermDefaultsNotFound->problem());
    }
}
