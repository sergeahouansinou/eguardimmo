<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use Illuminate\Support\Facades\View;

final class ReportHtml
{
    /**
     * Le HTML ne lit que l'instantané : même contenu, même pièce. `$apercu` ajoute le filigrane « Projet ».
     *
     * @param  array<string, mixed>  $instantane
     */
    public function render(array $instantane, bool $apercu = false): string
    {
        return View::make('reporting::management-report', ['s' => $instantane, 'apercu' => $apercu])->render();
    }
}
