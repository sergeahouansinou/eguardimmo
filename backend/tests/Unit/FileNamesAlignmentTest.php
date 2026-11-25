<?php

declare(strict_types=1);

use App\Modules\Documents\Support\FileNames;

it('remplace une extension dont la minuscule change de taille sans couper un caractère multioctet', function (string $nom, string $attendu): void {
    $aligne = FileNames::aligned($nom, ['pdf']);

    expect($aligne)->toBe($attendu)->and(mb_check_encoding($aligne, 'UTF-8'))->toBeTrue();
})->with([
    'extension İ' => ['rapport.İ', 'rapport.pdf'],
    'accent avant extension İ' => ['café.İ', 'café.pdf'],
    'extension ASCII inchangée' => ['café.html', 'café.pdf'],
    'extension admise en majuscules' => ['café.PDF', 'café.PDF'],
]);
