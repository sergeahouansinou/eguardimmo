<?php

declare(strict_types=1);

use App\Modules\Charges\Support\Csv as ChargesCsv;
use App\Modules\Organizations\Support\ActivityCsv;
use App\Modules\Reporting\Support\Csv as ReportingCsv;
use App\Modules\Tax\Support\Csv as TaxCsv;
use App\Shared\Csv\CsvField;

it('met le texte entre guillemets et double les guillemets', function (): void {
    expect(CsvField::render('Dupont'))->toBe('"Dupont"')
        ->and(CsvField::render('Le "Port"'))->toBe('"Le ""Port"""')
        ->and(CsvField::render(''))->toBe('""')
        ->and(CsvField::render(null))->toBe('""');
});

it('préfixe d\'une apostrophe un texte qui commence par un caractère de formule', function (string $texte, string $attendu): void {
    expect(CsvField::render($texte))->toBe($attendu);
})->with([
    'égal' => ['=1+1', '"\'=1+1"'],
    'plus' => ['+33612345678', '"\'+33612345678"'],
    'moins' => ['-2+3', '"\'-2+3"'],
    'arobase' => ['@SUM(A1)', '"\'@SUM(A1)"'],
    'tabulation' => ["\t=1+1", '"\'=1+1"'],
    'retour chariot' => ["\r=1+1", '"\'=1+1"'],
    'saut de ligne avant la formule' => ["\n=1+1", '"\'=1+1"'],
    'retour chariot et saut de ligne' => ["\r\n@x", '"\'@x"'],
    'plusieurs sauts de ligne' => ["\n\n\r\n+cmd", '"\'+cmd"'],
    'espaces puis formule' => ['  =1+1', '"\'=1+1"'],
]);

it('remplace les retours à la ligne internes par des espaces sans préfixe', function (): void {
    expect(CsvField::render("12 rue\nDu Port\r\n75001"))->toBe('"12 rue Du Port 75001"')
        ->and(CsvField::render('Bonjour =1+1'))->toBe('"Bonjour =1+1"');
});

it('laisse un entier brut, négatif compris : c\'est un nombre, pas une formule', function (): void {
    expect(CsvField::render(-12500))->toBe('-12500')->and(CsvField::render(64120))->toBe('64120')->and(CsvField::render(0))->toBe('0');
});

it('sert les quatre écrivains de module avec la même neutralisation', function (): void {
    $lignes = [["\n=1+1", "\r\n@x", 'Texte', -5]];
    $attendu = "\"'=1+1\";\"'@x\";\"Texte\";-5";

    expect(ReportingCsv::render($lignes))->toBe("\u{FEFF}{$attendu}\r\n")
        ->and(ChargesCsv::render($lignes))->toBe("\u{FEFF}{$attendu}\r\n")
        ->and(TaxCsv::render($lignes))->toBe("\u{FEFF}{$attendu}\r\n")
        ->and(ActivityCsv::line(["\n=1+1", "\r\n@x", 'Texte', null]))->toBe("\"'=1+1\";\"'@x\";\"Texte\";\"\"\r\n");
});
