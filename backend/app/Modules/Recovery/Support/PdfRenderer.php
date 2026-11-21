<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Shared\Pdf\GotenbergRenderer;

/**
 * Le PDF vient toujours d'un service Gotenberg : aucune génération de PDF en PHP.
 */
final readonly class PdfRenderer
{
    public function __construct(private GotenbergRenderer $gotenberg) {}

    public function render(string $html): string
    {
        return $this->gotenberg->render($html, config('recovery.gotenberg.url'), config('recovery.gotenberg.timeout'), 'RECOVERY_GOTENBERG_URL')
            ?? throw ErrorCode::PdfUnavailable->problem();
    }
}
