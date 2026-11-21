<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Shared\Pdf\GotenbergRenderer;

final readonly class PdfRenderer
{
    public function __construct(private GotenbergRenderer $gotenberg) {}

    public function render(string $html): string
    {
        return $this->gotenberg->render($html, config('reporting.gotenberg.url'), config('reporting.gotenberg.timeout'), 'REPORTING_GOTENBERG_URL')
            ?? throw ErrorCode::PdfUnavailable->problem();
    }
}
