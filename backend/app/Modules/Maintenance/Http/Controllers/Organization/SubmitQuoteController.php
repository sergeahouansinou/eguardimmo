<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\SubmitQuote;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class SubmitQuoteController
{
    public function __invoke(string $intervention, string $quote, SubmitQuote $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $quote);

        return $presenter->show($intervention);
    }
}
