<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Http\Resources\Console\MarketingOptionsResource;
use App\Modules\Notifications\Support\MarketingOptions;

final class ShowMarketingOptionsController
{
    public function __invoke(MarketingOptions $options): MarketingOptionsResource
    {
        return new MarketingOptionsResource($options->all());
    }
}
