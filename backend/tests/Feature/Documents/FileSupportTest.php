<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Support\FileInspector;
use App\Modules\Documents\Support\FileNames;
use Tests\Feature\Documents\DocumentsContext as D;

function fichierTemporaire(string $contenu): string
{
    $chemin = tempnam(sys_get_temp_dir(), 'insp');
    file_put_contents($chemin, $contenu);

    return $chemin;
}

it('retire les caractères bidirectionnels du nom affiché', function (): void {
    $piege = "facture\u{202E}fdp.exe";
    $tous = "a\u{200E}b\u{200F}c\u{202A}d\u{202B}e\u{202C}f\u{202D}g\u{202E}h\u{2066}i\u{2067}j\u{2068}k\u{2069}l.pdf";

    expect(FileNames::display($piege))->toBe('facturefdp.exe')
        ->and(FileNames::display($tous))->toBe('abcdefghijkl.pdf')
        ->and(FileNames::archiveEntry($tous))->toBe('abcdefghijkl.pdf')
        ->and(FileNames::display("\u{202E}\u{2066}"))->toBe('document')
        ->and(FileNames::display('Contrat d\'été é.pdf'))->toBe('Contrat d\'été é.pdf');
});

it('détecte une balise PHP à cheval sur deux blocs de lecture', function (int $decalage): void {
    $bloc = 65536;
    $contenu = D::PDF.str_repeat(' ', $bloc - strlen(D::PDF) - $decalage).'<?php system($_GET["c"]);'.str_repeat(' ', 200);
    $chemin = fichierTemporaire($contenu);

    expect(FileInspector::problem($chemin, FileCategory::Supporting))->toBe(ErrorCode::FileUnsafe);

    unlink($chemin);
})->with([0, 1, 2, 3, 4, 5, 6]);

it('détecte une balise PHP loin dans un fichier de plusieurs blocs', function (): void {
    $chemin = fichierTemporaire(D::PDF.str_repeat('x', 300000).'<?= `ls` ?>');

    expect(FileInspector::problem($chemin, FileCategory::Supporting))->toBe(ErrorCode::FileUnsafe);

    unlink($chemin);
});

it('accepte un PDF sain de plusieurs blocs', function (): void {
    $chemin = fichierTemporaire(D::PDF.str_repeat('x', 300000).'<? pas php ?>');

    expect(FileInspector::problem($chemin, FileCategory::Supporting))->toBeNull();

    unlink($chemin);
});
