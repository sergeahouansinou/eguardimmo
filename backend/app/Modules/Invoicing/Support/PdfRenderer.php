<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Shared\Pdf\GotenbergRenderer;

/**
 * Le PDF vient toujours d'un service Gotenberg : aucune génération de PDF en PHP.
 */
final readonly class PdfRenderer
{
    public function __construct(private GotenbergRenderer $gotenberg) {}

    public const int DELAI_MAX = 15;

    /**
     * Le rendu se fait sous le verrou du compteur de numéros (le numéro figure sur le PDF) : le délai est borné pour qu'une
     * panne lente de Gotenberg ne bloque pas longtemps les émissions suivantes.
     */
    public function timeout(): int
    {
        $delai = config('invoicing.gotenberg.timeout');

        return is_int($delai) ? max(1, min(self::DELAI_MAX, $delai)) : self::DELAI_MAX;
    }

    public function render(string $html): string
    {
        return $this->gotenberg->render($html, config('invoicing.gotenberg.url'), $this->timeout(), 'INVOICING_GOTENBERG_URL')
            ?? throw ErrorCode::PdfUnavailable->problem();
    }
}
