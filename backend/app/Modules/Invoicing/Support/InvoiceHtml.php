<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use Illuminate\Support\Facades\View;

final class InvoiceHtml
{
    /**
     * Le HTML ne lit que l'instantané : même contenu, même pièce.
     *
     * @param  array<string, mixed>  $snapshot
     */
    public function render(array $snapshot): string
    {
        return View::make('invoicing::invoice', ['s' => $snapshot])->render();
    }
}
