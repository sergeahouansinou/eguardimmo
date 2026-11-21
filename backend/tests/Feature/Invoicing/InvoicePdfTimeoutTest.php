<?php

declare(strict_types=1);

use App\Modules\Invoicing\Support\PdfRenderer;

it('le délai de Gotenberg est borné, le rendu se faisant sous le verrou du compteur de numéros', function (int|string|null $configure, int $attendu): void {
    config(['invoicing.gotenberg.timeout' => $configure]);

    expect(app(PdfRenderer::class)->timeout())->toBe($attendu);
})->with([
    'valeur excessive' => [600, 15],
    'valeur normale' => [8, 8],
    'zéro' => [0, 1],
    'invalide' => ['lent', 15],
]);
