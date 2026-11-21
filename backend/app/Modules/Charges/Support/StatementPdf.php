<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Shared\Pdf\GotenbergRenderer;
use Illuminate\Support\Facades\View;

/**
 * Le PDF vient toujours d'un service Gotenberg : aucune génération de PDF en PHP.
 */
final readonly class StatementPdf
{
    public function __construct(private GotenbergRenderer $gotenberg) {}

    /**
     * Le HTML ne lit que l'instantané : même contenu, même pièce.
     *
     * @param  array<string, mixed>  $snapshot
     */
    public function render(array $snapshot): string
    {
        $html = View::make('charges::statement', ['s' => $snapshot])->render();

        return $this->gotenberg->render($html, config('charges.gotenberg.url'), config('charges.gotenberg.timeout'), 'CHARGES_GOTENBERG_URL')
            ?? throw ErrorCode::PdfUnavailable->problem();
    }
}
