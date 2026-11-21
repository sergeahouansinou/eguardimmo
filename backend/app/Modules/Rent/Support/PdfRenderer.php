<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Enums\ErrorCode;
use App\Shared\Pdf\GotenbergRenderer;

/**
 * Le PDF vient toujours d'un service Gotenberg : aucune génération de PDF en PHP.
 */
final readonly class PdfRenderer
{
    public function __construct(private GotenbergRenderer $gotenberg) {}

    public function render(string $html): string
    {
        return $this->gotenberg->render($html, config('rent.gotenberg.url'), config('rent.gotenberg.timeout'), 'RENT_GOTENBERG_URL')
            ?? throw ErrorCode::PdfUnavailable->problem();
    }
}
