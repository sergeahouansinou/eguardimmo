<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Modules\Tax\Enums\ErrorCode;
use App\Shared\Pdf\GotenbergRenderer;

final readonly class SummaryPdf
{
    public function __construct(private GotenbergRenderer $gotenberg) {}

    public function render(string $html): string
    {
        return $this->gotenberg->render($html, config('tax.gotenberg.url'), config('tax.gotenberg.timeout'), 'TAX_GOTENBERG_URL')
            ?? throw ErrorCode::PdfUnavailable->problem();
    }
}
